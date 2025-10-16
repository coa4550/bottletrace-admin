import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Normalize distributor names for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Get first significant word from distributor name (excluding "the")
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

    // Fetch ALL existing distributors for fuzzy matching
    let existingDistributors = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_distributors')
        .select('distributor_id, distributor_name, distributor_url, distributor_logo_url')
        .range(start, start + pageSize - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        existingDistributors = [...existingDistributors, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const THRESHOLD = 0.75;

    // Process each distributor in the import
    const distributorReviews = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const distributorName = (row.distributor_name || '').trim();
      
      if (!distributorName) {
        distributorReviews.push({
          rowIndex: i,
          distributorName: '',
          error: 'Missing distributor_name',
          matchType: 'error'
        });
        continue;
      }

      // Check for exact match
      let matchedDistributor = existingDistributors.find(d => d.distributor_name === distributorName);
      let matchType = 'new';
      let suggestedMatch = null;
      let bestSimilarity = 0;

      if (matchedDistributor) {
        matchType = 'exact';
      } else {
        // Check for first word match
        const importFirstWord = getFirstWord(distributorName);
        const normalizedImportName = normalizeName(distributorName);
        
        for (const existing of existingDistributors) {
          const normalizedExisting = normalizeName(existing.distributor_name);
          const existingFirstWord = getFirstWord(existing.distributor_name);
          
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
          matchedDistributor = suggestedMatch;
        }
      }

      distributorReviews.push({
        rowIndex: i,
        distributorName,
        distributorUrl: (row.distributor_url || '').trim(),
        distributorLogoUrl: (row.distributor_logo_url || '').trim(),
        matchType,
        matchedDistributor: matchedDistributor ? {
          distributor_id: matchedDistributor.distributor_id,
          distributor_name: matchedDistributor.distributor_name,
          distributor_url: matchedDistributor.distributor_url,
          distributor_logo_url: matchedDistributor.distributor_logo_url
        } : null,
        similarity: matchType === 'fuzzy' ? bestSimilarity : null,
        action: matchType === 'new' ? 'create' : (matchType === 'exact' ? 'update' : 'match')
      });
    }

    // Group by match type for easier display
    const exactMatches = distributorReviews.filter(d => d.matchType === 'exact');
    const fuzzyMatches = distributorReviews.filter(d => d.matchType === 'fuzzy');
    const newDistributors = distributorReviews.filter(d => d.matchType === 'new');
    const errors = distributorReviews.filter(d => d.matchType === 'error');

    return NextResponse.json({
      distributorReviews,
      summary: {
        total: rows.length,
        exact: exactMatches.length,
        fuzzy: fuzzyMatches.length,
        new: newDistributors.length,
        errors: errors.length
      },
      allExistingDistributors: existingDistributors.sort((a, b) => a.distributor_name.localeCompare(b.distributor_name))
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
