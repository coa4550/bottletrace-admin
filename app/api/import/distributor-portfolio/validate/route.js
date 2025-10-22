import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Normalize names for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

// Get first significant word from name (excluding "the")
function getFirstWord(name) {
  const normalized = normalizeName(name);
  const words = normalized.split(' ').filter(w => w.length > 0);
  
  // Skip "the" if it's the first word
  if (words.length > 0 && words[0] === 'the') {
    return words[1] || words[0];
  }
  
  return words[0] || '';
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

    // Fetch ALL existing distributors for fuzzy matching (with pagination)
    let existingDistributors = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_distributors')
        .select('distributor_id, distributor_name')
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

    // Fetch ALL existing suppliers for fuzzy matching (with pagination)
    let existingSuppliers = [];
    start = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_suppliers')
        .select('supplier_id, supplier_name')
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

    // Fetch all existing states
    const { data: existingStates, error: statesError } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');

    if (statesError) throw statesError;

    // Similarity threshold (75% match or higher)
    const THRESHOLD = 0.75;

    // Get unique distributor-supplier relationships from import
    const relationshipKeys = new Set();
    const relationshipMap = new Map();
    
    rows.forEach((row, index) => {
      const distributorName = (row.distributor_name || '').trim();
      const supplierName = (row.supplier_name || '').trim();
      const stateName = (row.state_name || '').trim();
      const stateCode = (row.state_code || '').trim();
      
      if (!distributorName || !supplierName || (!stateName && !stateCode)) return;
      
      const key = `${distributorName}|${supplierName}`;
      relationshipKeys.add(key);
      
      if (!relationshipMap.has(key)) {
        relationshipMap.set(key, {
          distributorName,
          supplierName,
          rows: []
        });
      }
      
      relationshipMap.get(key).rows.push({ ...row, originalIndex: index });
    });

    // Build comprehensive review data for each relationship
    const relationshipReviews = [];

    for (const [key, relationship] of relationshipMap) {
      const { distributorName, supplierName, rows: relationshipRows } = relationship;
      
      // Find or create distributor ID
      let distributor = existingDistributors.find(d => d.distributor_name === distributorName);
      let distributorId = distributor?.distributor_id;

      // Find or create supplier ID
      let supplier = existingSuppliers.find(s => s.supplier_name === supplierName);
      let supplierId = supplier?.supplier_id;

      // Process distributor matching
      let distributorMatchType = 'new';
      let distributorMatched = distributor;
      let distributorSimilarity = 0;

      if (distributor) {
        distributorMatchType = 'exact';
      } else {
        // Check for fuzzy match
        const normalizedDistributorName = normalizeName(distributorName);
        const distributorFirstWord = getFirstWord(distributorName);
        
        for (const existing of existingDistributors) {
          const normalizedExisting = normalizeName(existing.distributor_name);
          const existingFirstWord = getFirstWord(existing.distributor_name);
          
          // High confidence if first words match (excluding "the")
          if (distributorFirstWord && distributorFirstWord === existingFirstWord && distributorFirstWord.length > 2) {
            const sim = 0.95; // High confidence score for first word match
            if (sim > distributorSimilarity) {
              distributorMatched = existing;
              distributorSimilarity = sim;
            }
          } else {
            // Regular Levenshtein similarity
            const sim = similarity(normalizedDistributorName, normalizedExisting);
            
            if (sim >= THRESHOLD && sim > distributorSimilarity) {
              distributorMatched = existing;
              distributorSimilarity = sim;
            }
          }
        }

        if (distributorMatched && distributorSimilarity >= THRESHOLD) {
          distributorMatchType = 'fuzzy';
        }
      }

      // Process supplier matching
      let supplierMatchType = 'new';
      let supplierMatched = supplier;
      let supplierSimilarity = 0;

      if (supplier) {
        supplierMatchType = 'exact';
      } else {
        // Check for fuzzy match
        const normalizedSupplierName = normalizeName(supplierName);
        const supplierFirstWord = getFirstWord(supplierName);
        
        for (const existing of existingSuppliers) {
          const normalizedExisting = normalizeName(existing.supplier_name);
          const existingFirstWord = getFirstWord(existing.supplier_name);
          
          // High confidence if first words match (excluding "the")
          if (supplierFirstWord && supplierFirstWord === existingFirstWord && supplierFirstWord.length > 2) {
            const sim = 0.95; // High confidence score for first word match
            if (sim > supplierSimilarity) {
              supplierMatched = existing;
              supplierSimilarity = sim;
            }
          } else {
            // Regular Levenshtein similarity
            const sim = similarity(normalizedSupplierName, normalizedExisting);
            
            if (sim >= THRESHOLD && sim > supplierSimilarity) {
              supplierMatched = existing;
              supplierSimilarity = sim;
            }
          }
        }

        if (supplierMatched && supplierSimilarity >= THRESHOLD) {
          supplierMatchType = 'fuzzy';
        }
      }

      // Process states
      const processedStates = [];
      for (const row of relationshipRows) {
        const stateName = (row.state_name || '').trim();
        const stateCode = (row.state_code || '').trim();
        
        // Find state(s)
        let stateIds = [];
        if (stateCode && stateCode.toUpperCase() === 'ALL') {
          stateIds = existingStates?.map(s => s.state_id) || [];
        } else {
          // Handle comma-separated state codes
          const stateCodesToCheck = stateCode ? stateCode.split(',').map(s => s.trim()) : [];
          const stateNamesToCheck = stateName ? stateName.split(',').map(s => s.trim()) : [];
          
          const allStatesToCheck = [...stateCodesToCheck, ...stateNamesToCheck];
          const foundStates = [];

          for (const stateToCheck of allStatesToCheck) {
            if (stateToCheck) {
              const state = existingStates?.find(s => 
                s.state_code?.toLowerCase() === stateToCheck.toLowerCase() ||
                s.state_name?.toLowerCase() === stateToCheck.toLowerCase()
              );
              if (state) {
                foundStates.push(state);
              }
            }
          }

          stateIds = foundStates.map(s => s.state_id);
        }

        processedStates.push(...stateIds.map(stateId => ({
          stateId,
          state: existingStates.find(s => s.state_id === stateId)
        })));
      }

      // Remove duplicate states
      const uniqueStates = processedStates.filter((state, index, self) => 
        index === self.findIndex(s => s.stateId === state.stateId)
      );

      relationshipReviews.push({
        distributorName,
        supplierName,
        distributorMatchType,
        supplierMatchType,
        distributorMatched: distributorMatched ? {
          distributor_id: distributorMatched.distributor_id,
          distributor_name: distributorMatched.distributor_name
        } : null,
        supplierMatched: supplierMatched ? {
          supplier_id: supplierMatched.supplier_id,
          supplier_name: supplierMatched.supplier_name
        } : null,
        distributorSimilarity: distributorMatchType === 'fuzzy' ? distributorSimilarity : null,
        supplierSimilarity: supplierMatchType === 'fuzzy' ? supplierSimilarity : null,
        states: uniqueStates,
        rows: relationshipRows
      });
    }

    return NextResponse.json({
      totalRows: rows.length,
      relationshipReviews,
      allExistingDistributors: existingDistributors.sort((a, b) => a.distributor_name.localeCompare(b.distributor_name)),
      allExistingSuppliers: existingSuppliers.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)),
      allExistingStates: existingStates?.sort((a, b) => a.state_name.localeCompare(b.state_name)) || []
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}