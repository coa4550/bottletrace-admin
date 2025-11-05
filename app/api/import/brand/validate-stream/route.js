import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Validation functions (same as client-side but server-side)
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

function getFirstWord(name) {
  const normalized = normalizeName(name);
  const words = normalized.split(' ').filter(w => w.length > 0);
  if (words.length > 0 && words[0] === 'the') {
    return words[1] || words[0];
  }
  return words[0] || '';
}

function fastSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 1.0;
  const lenDiff = Math.abs(len1 - len2);
  const maxLen = Math.max(len1, len2);
  if (lenDiff > maxLen * 0.5) return 0;
  
  const chars1 = new Set(s1);
  const chars2 = new Set(s2);
  let intersection = 0;
  let union = chars1.size;
  for (const char of chars2) {
    if (chars1.has(char)) intersection++;
    else union++;
  }
  const jaccard = intersection / union;
  return jaccard * 0.8; // Simplified for speed
}

function validateRow(row, rowIndex, brandMap, firstWordMap, lengthIndexMap) {
  const brandName = (row.brand_name || '').trim();
  if (!brandName) {
    return {
      rowIndex,
      brandName: '',
      error: 'Missing brand_name',
      matchType: 'error'
    };
  }

  let matchedBrand = brandMap.get(brandName);
  let matchType = 'new';
  let bestSimilarity = 0;

  if (matchedBrand) {
    matchType = 'exact';
  } else {
    const importFirstWord = getFirstWord(brandName);
    if (importFirstWord && importFirstWord.length > 2 && firstWordMap.has(importFirstWord)) {
      const candidates = firstWordMap.get(importFirstWord).slice(0, 50);
      if (candidates.length > 0) {
        matchedBrand = candidates[0];
        matchType = 'fuzzy';
        bestSimilarity = 0.95;
      }
    }
    
    if (!matchedBrand) {
      const normalizedImportName = normalizeName(brandName);
      const importLen = normalizedImportName.length;
      const minLen = Math.max(1, Math.floor(importLen * 0.7));
      const maxLen = Math.ceil(importLen * 1.3);
      
      const candidates = [];
      for (let len = minLen; len <= maxLen; len++) {
        if (lengthIndexMap.has(len)) {
          candidates.push(...lengthIndexMap.get(len));
        }
      }
      
      if (candidates.length > 100) {
        candidates.sort((a, b) => {
          const aLen = normalizeName(a.brand_name).length;
          const bLen = normalizeName(b.brand_name).length;
          return Math.abs(aLen - importLen) - Math.abs(bLen - importLen);
        });
        candidates.splice(100);
      }
      
      for (const existing of candidates.slice(0, 100)) {
        const normalizedExisting = normalizeName(existing.brand_name);
        if (Math.abs(normalizedExisting.length - normalizedImportName.length) > normalizedImportName.length * 0.4) continue;
        
        const sim = fastSimilarity(normalizedImportName, normalizedExisting);
        if (sim >= 0.75 && sim > bestSimilarity) {
          matchedBrand = existing;
          bestSimilarity = sim;
          matchType = 'fuzzy';
          if (sim >= 0.80) break;
        }
      }
    }
  }

  const categoriesArray = (row.brand_categories || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);
  const subCategoriesArray = (row.brand_sub_categories || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  return {
    rowIndex,
    brandName,
    brandUrl: (row.brand_url || '').trim(),
    brandLogoUrl: (row.brand_logo_url || '').trim(),
    dataSource: (row.data_source || 'csv_import').trim(),
    categories: categoriesArray,
    subCategories: subCategoriesArray,
    matchType,
    matchedBrand: matchedBrand ? {
      brand_id: matchedBrand.brand_id,
      brand_name: matchedBrand.brand_name,
      brand_url: matchedBrand.brand_url,
      brand_logo_url: matchedBrand.brand_logo_url,
      data_source: matchedBrand.data_source
    } : null,
    similarity: matchType === 'fuzzy' ? bestSimilarity : null,
    action: matchType === 'new' ? 'create' : (matchType === 'exact' ? 'update' : 'match')
  };
}

// In-memory job storage (for production, use Redis or database)
const jobs = new Map();

export async function POST(req) {
  try {
    const { rows, jobId } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const currentJobId = jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job
    jobs.set(currentJobId, {
      status: 'processing',
      progress: 0,
      total: rows.length,
      results: null,
      error: null
    });

    // Start processing in background (fire and forget)
    processValidation(rows, currentJobId).catch(error => {
      const job = jobs.get(currentJobId);
      if (job) {
        job.status = 'error';
        job.error = error.message;
      }
    });

    return NextResponse.json({ jobId: currentJobId });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processValidation(rows, jobId) {
  try {
    const job = jobs.get(jobId);
    if (!job) return;

    // Fetch metadata once
    job.status = 'fetching_metadata';
    job.progress = 0;
    job.message = 'Fetching existing brands...';

    let existingBrands = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_brands')
        .select('brand_id, brand_name, brand_url, brand_logo_url, data_source')
        .range(start, start + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        existingBrands = [...existingBrands, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('categories')
      .select('category_id, category_name');
    if (categoriesError) throw categoriesError;

    const { data: subCategories, error: subCategoriesError } = await supabaseAdmin
      .from('sub_categories')
      .select('sub_category_id, sub_category_name, category_id');
    if (subCategoriesError) throw subCategoriesError;

    // Build indexes
    job.message = 'Preparing validation data...';
    const brandMap = new Map();
    const firstWordMap = new Map();
    const lengthIndexMap = new Map();

    for (const brand of existingBrands) {
      brandMap.set(brand.brand_name, brand);
      const firstWord = getFirstWord(brand.brand_name);
      if (firstWord && firstWord.length > 2) {
        if (!firstWordMap.has(firstWord)) firstWordMap.set(firstWord, []);
        firstWordMap.get(firstWord).push(brand);
      }
      const normalized = normalizeName(brand.brand_name);
      const len = normalized.length;
      if (!lengthIndexMap.has(len)) lengthIndexMap.set(len, []);
      lengthIndexMap.get(len).push(brand);
    }

    // Process rows in batches
    job.status = 'validating';
    job.message = 'Validating rows...';
    const brandReviews = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      for (let j = 0; j < batch.length; j++) {
        const review = validateRow(batch[j], i + j, brandMap, firstWordMap, lengthIndexMap);
        brandReviews.push(review);
      }
      job.progress = Math.min(i + batch.length, rows.length);
      job.message = `Validating row ${job.progress} of ${rows.length}...`;
    }

    // Calculate summary
    const summary = brandReviews.reduce((acc, brand) => {
      acc[brand.matchType] = (acc[brand.matchType] || 0) + 1;
      return acc;
    }, { total: rows.length, exact: 0, fuzzy: 0, new: 0, error: 0 });

    // Store results
    job.status = 'complete';
    job.progress = rows.length;
    job.message = 'Validation complete!';
    job.results = {
      brandReviews,
      summary: {
        total: summary.total,
        exact: summary.exact || 0,
        fuzzy: summary.fuzzy || 0,
        new: summary.new || 0,
        errors: summary.error || 0
      },
      allExistingBrands: existingBrands.sort((a, b) => a.brand_name.localeCompare(b.brand_name)),
      categories,
      subCategories
    };

    // Clean up job after 1 hour
    setTimeout(() => jobs.delete(jobId), 3600000);
  } catch (error) {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error.message;
    }
  }
}

// Get job status
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const job = jobs.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress,
      total: job.total,
      message: job.message,
      results: job.results,
      error: job.error
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

