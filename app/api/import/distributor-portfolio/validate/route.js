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
    const { rows } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Fetch ALL existing brands for fuzzy matching (with pagination)
    let existingBrands = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_brands')
        .select('brand_id, brand_name')
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

    // Fetch all existing distributors
    const { data: existingDistributors, error: distributorsError } = await supabaseAdmin
      .from('core_distributors')
      .select('distributor_id, distributor_name');

    if (distributorsError) throw distributorsError;

    // Similarity threshold
    const THRESHOLD = 0.75;

    // Get unique distributors from import
    const distributorNames = [...new Set(rows.map(r => (r.distributor_name || '').trim()).filter(Boolean))];
    
    const distributorReviews = [];

    for (const distributorName of distributorNames) {
      let distributor = existingDistributors.find(d => d.distributor_name === distributorName);
      let distributorId = distributor?.distributor_id;

      const distributorRows = rows
        .map((row, index) => ({ ...row, originalIndex: index }))
        .filter(row => (row.distributor_name || '').trim() === distributorName);

      // Get existing relationships for this distributor
      let existingRelationships = [];
      if (distributorId) {
        const { data: rels } = await supabaseAdmin
          .from('brand_distributor_state')
          .select('brand_id, state_id, core_brands(brand_name), core_states(state_code)')
          .eq('distributor_id', distributorId);
        
        existingRelationships = rels || [];
      }

      const importBrands = [];
      const importedBrandIds = new Set();

      for (const row of distributorRows) {
        const brandName = (row.brand_name || '').trim();
        const stateCode = (row.state_code || '').trim();
        
        if (!brandName) continue;

        // Check for exact match
        let matchedBrand = existingBrands.find(b => b.brand_name === brandName);
        let matchType = 'new';
        let suggestedMatch = null;
        let bestSimilarity = 0;

        if (matchedBrand) {
          matchType = 'exact';
          importedBrandIds.add(matchedBrand.brand_id);
        } else {
          // Check for first word match
          const importFirstWord = getFirstWord(brandName);
          const normalizedImportName = normalizeName(brandName);
          
          for (const existing of existingBrands) {
            const normalizedExisting = normalizeName(existing.brand_name);
            const existingFirstWord = getFirstWord(existing.brand_name);
            
            // High confidence if first words match
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

        importBrands.push({
          rowIndex: row.originalIndex,
          brandName,
          stateCode: stateCode || 'ALL',
          matchType,
          matchedBrand: matchedBrand ? {
            brand_id: matchedBrand.brand_id,
            brand_name: matchedBrand.brand_name
          } : null,
          similarity: matchType === 'fuzzy' ? bestSimilarity : null,
          action: matchType === 'new' ? 'create' : 'match'
        });

        if (matchedBrand) {
          importedBrandIds.add(matchedBrand.brand_id);
        }
      }

      // Note: Orphaning disabled for simplicity
      const orphanedBrands = [];

      distributorReviews.push({
        distributorName,
        distributorId,
        importBrands,
        orphanedBrands
      });
    }

    return NextResponse.json({
      distributorReviews,
      allExistingBrands: existingBrands.sort((a, b) => a.brand_name.localeCompare(b.brand_name))
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

