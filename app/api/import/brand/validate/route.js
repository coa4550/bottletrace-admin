import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Normalize brand names for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Get first significant word from brand name (excluding "the")
function getFirstWord(name) {
  const normalized = normalizeName(name);
  const words = normalized.split(' ').filter(w => w.length > 0);
  
  if (words.length > 0 && words[0] === 'the') {
    return words[1] || words[0];
  }
  
  return words[0] || '';
}

// Calculate similarity between two strings
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export async function POST(req) {
  try {
    const { rows, metadataOnly } = await req.json();
    
    // If metadataOnly is true, just return existing brands, categories, and sub-categories
    if (metadataOnly) {
      // Fetch ALL existing brands for fuzzy matching
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

      // Fetch all categories and sub-categories
      const { data: categories, error: categoriesError } = await supabaseAdmin
        .from('categories')
        .select('category_id, category_name');
      
      if (categoriesError) throw categoriesError;

      const { data: subCategories, error: subCategoriesError } = await supabaseAdmin
        .from('sub_categories')
        .select('sub_category_id, sub_category_name, category_id');
      
      if (subCategoriesError) throw subCategoriesError;

      return NextResponse.json({
        allExistingBrands: existingBrands.sort((a, b) => a.brand_name.localeCompare(b.brand_name)),
        categories,
        subCategories
      });
    }
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Fetch ALL existing brands for fuzzy matching
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

    // Fetch all categories and sub-categories
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('categories')
      .select('category_id, category_name');
    
    if (categoriesError) throw categoriesError;

    const { data: subCategories, error: subCategoriesError } = await supabaseAdmin
      .from('sub_categories')
      .select('sub_category_id, sub_category_name, category_id');
    
    if (subCategoriesError) throw subCategoriesError;

    const THRESHOLD = 0.75;

    // Process each brand in the import
    const brandReviews = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const brandName = (row.brand_name || '').trim();
      
      if (!brandName) {
        brandReviews.push({
          rowIndex: i,
          brandName: '',
          error: 'Missing brand_name',
          matchType: 'error'
        });
        continue;
      }

      // Check for exact match
      let matchedBrand = existingBrands.find(b => b.brand_name === brandName);
      let matchType = 'new';
      let suggestedMatch = null;
      let bestSimilarity = 0;

      if (matchedBrand) {
        matchType = 'exact';
      } else {
        // Check for first word match
        const importFirstWord = getFirstWord(brandName);
        const normalizedImportName = normalizeName(brandName);
        
        for (const existing of existingBrands) {
          const normalizedExisting = normalizeName(existing.brand_name);
          const existingFirstWord = getFirstWord(existing.brand_name);
          
          if (importFirstWord && importFirstWord === existingFirstWord && importFirstWord.length > 2) {
            const sim = 0.95;
            if (sim > bestSimilarity) {
              suggestedMatch = existing;
              bestSimilarity = sim;
            }
          } else {
            const sim = similarity(normalizedImportName, normalizedExisting);
            
            if (sim >= THRESHOLD && sim > bestSimilarity) {
              suggestedMatch = existing;
              bestSimilarity = sim;
            }
          }
        }

        if (suggestedMatch) {
          matchType = 'fuzzy';
          matchedBrand = suggestedMatch;
        }
      }

      // Parse categories and sub-categories
      const categoriesArray = (row.brand_categories || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
      
      const subCategoriesArray = (row.brand_sub_categories || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      brandReviews.push({
        rowIndex: i,
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
      });
    }

    // Group by match type for easier display
    const exactMatches = brandReviews.filter(b => b.matchType === 'exact');
    const fuzzyMatches = brandReviews.filter(b => b.matchType === 'fuzzy');
    const newBrands = brandReviews.filter(b => b.matchType === 'new');
    const errors = brandReviews.filter(b => b.matchType === 'error');

    return NextResponse.json({
      brandReviews,
      summary: {
        total: rows.length,
        exact: exactMatches.length,
        fuzzy: fuzzyMatches.length,
        new: newBrands.length,
        errors: errors.length
      },
      allExistingBrands: existingBrands.sort((a, b) => a.brand_name.localeCompare(b.brand_name)),
      categories,
      subCategories
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

