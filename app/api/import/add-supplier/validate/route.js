import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Normalize supplier names for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Get first significant word from supplier name (excluding "the")
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

    // Fetch ALL existing suppliers for fuzzy matching
    let existingSuppliers = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_suppliers')
        .select('supplier_id, supplier_name, supplier_url, supplier_logo_url, data_source')
        .range(start, start + pageSize - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        existingSuppliers = [...existingSuppliers, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const THRESHOLD = 0.75;

    // Process each supplier in the import
    const supplierReviews = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const supplierName = (row.supplier_name || '').trim();
      
      if (!supplierName) {
        supplierReviews.push({
          rowIndex: i,
          supplierName: '',
          error: 'Missing supplier_name',
          matchType: 'error'
        });
        continue;
      }

      // Check for exact match
      let matchedSupplier = existingSuppliers.find(s => s.supplier_name === supplierName);
      let matchType = 'new';
      let suggestedMatch = null;
      let bestSimilarity = 0;

      if (matchedSupplier) {
        matchType = 'exact';
      } else {
        // Check for first word match
        const importFirstWord = getFirstWord(supplierName);
        const normalizedImportName = normalizeName(supplierName);
        
        for (const existing of existingSuppliers) {
          const normalizedExisting = normalizeName(existing.supplier_name);
          const existingFirstWord = getFirstWord(existing.supplier_name);
          
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
          matchedSupplier = suggestedMatch;
        }
      }

      supplierReviews.push({
        rowIndex: i,
        supplierName,
        supplierUrl: (row.supplier_url || '').trim(),
        supplierLogoUrl: (row.supplier_logo_url || '').trim(),
        dataSource: (row.data_source || 'csv_import').trim(),
        matchType,
        matchedSupplier: matchedSupplier ? {
          supplier_id: matchedSupplier.supplier_id,
          supplier_name: matchedSupplier.supplier_name,
          supplier_url: matchedSupplier.supplier_url,
          supplier_logo_url: matchedSupplier.supplier_logo_url,
          data_source: matchedSupplier.data_source
        } : null,
        similarity: matchType === 'fuzzy' ? bestSimilarity : null,
        action: matchType === 'new' ? 'create' : (matchType === 'exact' ? 'update' : 'match')
      });
    }

    // Group by match type for easier display
    const exactMatches = supplierReviews.filter(s => s.matchType === 'exact');
    const fuzzyMatches = supplierReviews.filter(s => s.matchType === 'fuzzy');
    const newSuppliers = supplierReviews.filter(s => s.matchType === 'new');
    const errors = supplierReviews.filter(s => s.matchType === 'error');

    return NextResponse.json({
      supplierReviews,
      summary: {
        total: rows.length,
        exact: exactMatches.length,
        fuzzy: fuzzyMatches.length,
        new: newSuppliers.length,
        errors: errors.length
      },
      allExistingSuppliers: existingSuppliers.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name))
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
