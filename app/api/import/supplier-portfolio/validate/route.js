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

    // Fetch all existing suppliers
    const { data: existingSuppliers, error: suppliersError } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name');

    if (suppliersError) throw suppliersError;

    // Similarity threshold (75% match or higher)
    const THRESHOLD = 0.75;

    // Get unique suppliers from import
    const supplierNames = [...new Set(rows.map(r => (r.supplier_name || '').trim()).filter(Boolean))];
    
    // Build comprehensive review data for each supplier
    const supplierReviews = [];

    for (const supplierName of supplierNames) {
      // Find or create supplier ID
      let supplier = existingSuppliers.find(s => s.supplier_name === supplierName);
      let supplierId = supplier?.supplier_id;

      // Get all import rows for this supplier
      const supplierRows = rows
        .map((row, index) => ({ ...row, originalIndex: index }))
        .filter(row => (row.supplier_name || '').trim() === supplierName);

      // Get existing relationships for this supplier
      let existingRelationships = [];
      if (supplierId) {
        const { data: rels } = await supabaseAdmin
          .from('brand_supplier_state')
          .select('brand_id, state_id, core_brands(brand_name), core_states(state_code)')
          .eq('supplier_id', supplierId);
        
        existingRelationships = rels || [];
      }

      // Process import brands
      const importBrands = [];
      const importedBrandIds = new Set();

      for (const row of supplierRows) {
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
          // Check for fuzzy match
          const normalizedImportName = normalizeName(brandName);
          
          for (const existing of existingBrands) {
            const normalizedExisting = normalizeName(existing.brand_name);
            const sim = similarity(normalizedImportName, normalizedExisting);
            
            if (sim >= THRESHOLD && sim > bestSimilarity) {
              suggestedMatch = existing;
              bestSimilarity = sim;
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

      // Find orphaned relationships (in DB but not in import)
      const orphanedBrands = [];
      if (supplierId) {
        console.log(`Checking orphans for ${supplierName}, existing relationships:`, existingRelationships.length);
        console.log(`Import brand IDs:`, Array.from(importedBrandIds));
        
        const brandStateMap = new Map();
        
        // Group existing relationships by brand
        for (const rel of existingRelationships) {
          const brandId = rel.brand_id;
          if (!brandStateMap.has(brandId)) {
            brandStateMap.set(brandId, {
              brand_id: brandId,
              brand_name: rel.core_brands.brand_name,
              states: []
            });
          }
          brandStateMap.get(brandId).states.push(rel.core_states.state_code);
        }

        console.log(`Unique brands in existing relationships:`, brandStateMap.size);

        // Check which brands will be orphaned
        for (const [brandId, brandData] of brandStateMap.entries()) {
          if (!importedBrandIds.has(brandId)) {
            console.log(`Brand ${brandData.brand_name} will be orphaned (not in import)`);
            orphanedBrands.push({
              brand_id: brandId,
              brand_name: brandData.brand_name,
              states: brandData.states.join(', '),
              action: 'orphan'
            });
          }
        }
        
        console.log(`Total orphaned brands for ${supplierName}:`, orphanedBrands.length);
      }

      supplierReviews.push({
        supplierName,
        supplierId,
        importBrands,
        orphanedBrands
      });
    }

    return NextResponse.json({
      supplierReviews,
      allExistingBrands: existingBrands.sort((a, b) => a.brand_name.localeCompare(b.brand_name))
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

