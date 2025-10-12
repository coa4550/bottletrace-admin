import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Fetch all existing distributors
    const { data: existingDistributors, error: distributorsError } = await supabaseAdmin
      .from('core_distributors')
      .select('distributor_id, distributor_name, distributor_logo_url');

    if (distributorsError) throw distributorsError;

    // Fetch all existing suppliers
    const { data: existingSuppliers, error: suppliersError } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name, supplier_logo_url');

    if (suppliersError) throw suppliersError;

    // Fetch all existing states
    const { data: existingStates, error: statesError } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');

    if (statesError) throw statesError;

    // Build lookup maps
    const distributorMap = new Map(existingDistributors?.map(d => [d.distributor_name.toLowerCase(), d]) || []);
    const supplierMap = new Map(existingSuppliers?.map(s => [s.supplier_name.toLowerCase(), s]) || []);
    const distributorNameMap = new Map(existingDistributors?.map(d => [d.distributor_name, d]) || []);
    const supplierNameMap = new Map(existingSuppliers?.map(s => [s.supplier_name, s]) || []);
    const stateCodeMap = new Map(existingStates?.map(s => [s.state_code?.toLowerCase(), s]) || []);
    const stateNameMap = new Map(existingStates?.map(s => [s.state_name?.toLowerCase(), s]) || []);

    // Track what will be created
    const newDistributorNames = new Set();
    const newSupplierNames = new Set();
    const newRelationships = new Set();
    const existingRelationships = new Set();
    const warnings = [];

    // Get unique distributor-supplier-state combos from import
    const importRelationships = new Map(); // Map<distributorName, Map<supplierName, Set<stateId>>>

    for (const row of rows) {
      const distributorName = (row.distributor_name || '').trim();
      const supplierName = (row.supplier_name || '').trim();
      const stateName = (row.state_name || '').trim();
      const stateCode = (row.state_code || '').trim();

      if (!distributorName || !supplierName || (!stateName && !stateCode)) {
        warnings.push(`Skipping row with missing data: ${JSON.stringify(row)}`);
        continue;
      }

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
        const notFoundStates = [];

        for (const stateToCheck of allStatesToCheck) {
          let state = null;
          if (stateToCheck) {
            state = stateCodeMap.get(stateToCheck.toLowerCase()) || stateNameMap.get(stateToCheck.toLowerCase());
          }
          
          if (state) {
            foundStates.push(state);
          } else {
            notFoundStates.push(stateToCheck);
          }
        }

        if (notFoundStates.length > 0) {
          warnings.push(`States not found: ${notFoundStates.join(', ')} (row: ${distributorName} - ${supplierName})`);
        }

        if (foundStates.length === 0) {
          continue; // Skip this row if no valid states found
        }

        stateIds = foundStates.map(s => s.state_id);
      }

      // Track new distributors
      if (!distributorMap.has(distributorName.toLowerCase())) {
        newDistributorNames.add(distributorName);
      }

      // Track new suppliers
      if (!supplierMap.has(supplierName.toLowerCase())) {
        newSupplierNames.add(supplierName);
      }

      // Track for relationship counting
      if (!importRelationships.has(distributorName)) {
        importRelationships.set(distributorName, new Map());
      }
      if (!importRelationships.get(distributorName).has(supplierName)) {
        importRelationships.get(distributorName).set(supplierName, new Set());
      }
      stateIds.forEach(stateId => {
        importRelationships.get(distributorName).get(supplierName).add(stateId);
      });
    }

    // Load existing relationships to count new vs existing
    const allDistributorIds = [];
    importRelationships.forEach((suppliers, distributorName) => {
      const dist = distributorMap.get(distributorName.toLowerCase());
      if (dist) allDistributorIds.push(dist.distributor_id);
    });

    let existingRelsMap = new Map(); // Map<distributorId_supplierId_stateId, true>
    
    if (allDistributorIds.length > 0) {
      const { data: existingRels } = await supabaseAdmin
        .from('distributor_supplier_state')
        .select('distributor_id, supplier_id, state_id')
        .in('distributor_id', allDistributorIds);

      existingRels?.forEach(rel => {
        existingRelsMap.set(`${rel.distributor_id}_${rel.supplier_id}_${rel.state_id}`, true);
      });
    }

    // Count new vs existing relationships
    importRelationships.forEach((suppliers, distributorName) => {
      const dist = distributorMap.get(distributorName.toLowerCase());
      const distId = dist?.distributor_id || 'NEW';

      suppliers.forEach((stateIds, supplierName) => {
        const supp = supplierMap.get(supplierName.toLowerCase());
        const suppId = supp?.supplier_id || 'NEW';

        stateIds.forEach(stateId => {
          const relKey = `${distId}_${suppId}_${stateId}`;
          
          if (distId === 'NEW' || suppId === 'NEW' || !existingRelsMap.has(relKey)) {
            newRelationships.add(relKey);
          } else {
            existingRelationships.add(relKey);
          }
        });
      });
    });

    // Get detailed lists for review
    const newDistributorsList = Array.from(newDistributorNames);
    const newSuppliersList = Array.from(newSupplierNames);
    const existingDistributorsList = [];
    const existingSuppliersList = [];
    
    // Find existing distributors and suppliers from the import
    const importDistributorNames = new Set();
    const importSupplierNames = new Set();
    
    for (const row of rows) {
      const distributorName = (row.distributor_name || '').trim();
      const supplierName = (row.supplier_name || '').trim();
      if (distributorName) importDistributorNames.add(distributorName);
      if (supplierName) importSupplierNames.add(supplierName);
    }
    
    importDistributorNames.forEach(name => {
      if (!newDistributorNames.has(name)) {
        existingDistributorsList.push(name);
      }
    });
    
    importSupplierNames.forEach(name => {
      if (!newSupplierNames.has(name)) {
        existingSuppliersList.push(name);
      }
    });

    // Build relationship details for the UI
    const relationshipDetails = [];
    importRelationships.forEach((suppliers, distributorName) => {
      suppliers.forEach((stateIds, supplierName) => {
        const distExists = !newDistributorNames.has(distributorName);
        const suppExists = !newSupplierNames.has(supplierName);
        
        const distributorInfo = distributorNameMap.get(distributorName);
        const supplierInfo = supplierNameMap.get(supplierName);
        
        relationshipDetails.push({
          distributorName,
          supplierName,
          distributorExists: distExists,
          supplierExists: suppExists,
          distributorLogoUrl: distributorInfo?.distributor_logo_url || null,
          supplierLogoUrl: supplierInfo?.supplier_logo_url || null,
          stateCount: stateIds.size,
          states: Array.from(stateIds).map(stateId => {
            const state = existingStates.find(s => s.state_id === stateId);
            return state ? { id: state.state_id, code: state.state_code, name: state.state_name } : null;
          }).filter(Boolean)
        });
      });
    });

    return NextResponse.json({
      totalRows: rows.length,
      newDistributors: newDistributorNames.size,
      newSuppliers: newSupplierNames.size,
      existingDistributors: existingDistributorsList.length,
      existingSuppliers: existingSuppliersList.length,
      newRelationships: newRelationships.size,
      existingRelationships: existingRelationships.size,
      newDistributorsList,
      newSuppliersList,
      existingDistributorsList,
      existingSuppliersList,
      relationshipDetails,
      allExistingDistributors: existingDistributors.sort((a, b) => a.distributor_name.localeCompare(b.distributor_name)),
      allExistingSuppliers: existingSuppliers.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)),
      warnings: warnings.slice(0, 50)
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

