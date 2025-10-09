import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Normalize brand names for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

// Calculate similarity between two strings (simple Levenshtein-based)
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

    // Fetch all existing brands for fuzzy matching
    const { data: existingBrands, error: brandsError } = await supabaseAdmin
      .from('core_brands')
      .select('brand_id, brand_name');

    if (brandsError) throw brandsError;

    // Fetch all existing suppliers
    const { data: existingSuppliers, error: suppliersError } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name');

    if (suppliersError) throw suppliersError;

    let validRows = 0;
    let invalidRows = 0;
    const fuzzyMatches = [];
    const matches = {};

    // Similarity threshold (75% match or higher)
    const THRESHOLD = 0.75;

    rows.forEach((row, index) => {
      const supplierName = (row.supplier_name || '').trim();
      const brandName = (row.brand_name || '').trim();
      const stateName = (row.state_name || '').trim();
      const stateCode = (row.state_code || '').trim();

      if (!supplierName || !brandName || (!stateName && !stateCode)) {
        invalidRows++;
        return;
      }

      validRows++;

      // Check for fuzzy brand matches
      const normalizedImportName = normalizeName(brandName);
      
      for (const existing of existingBrands) {
        const normalizedExisting = normalizeName(existing.brand_name);
        
        // Skip exact matches (handled normally)
        if (brandName === existing.brand_name) continue;
        
        const sim = similarity(normalizedImportName, normalizedExisting);
        
        if (sim >= THRESHOLD) {
          fuzzyMatches.push({
            rowIndex: index,
            importName: brandName,
            existingName: existing.brand_name,
            existingId: existing.brand_id,
            similarity: sim
          });
          
          // Default to using existing brand (can be overridden by user)
          matches[index] = {
            useExisting: true,
            existingBrandId: existing.brand_id,
            existingBrandName: existing.brand_name
          };
          
          break; // Only show the first match per import row
        }
      }
    });

    return NextResponse.json({
      validRows,
      invalidRows,
      fuzzyMatches,
      matches
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

