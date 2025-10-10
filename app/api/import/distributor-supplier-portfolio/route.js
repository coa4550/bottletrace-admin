import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { 
      rows, 
      fileName,
      isFirstBatch = true,
      isLastBatch = true,
      existingImportLogId = null
    } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Create import log entry only on first batch
    let importLogId = existingImportLogId;
    
    if (isFirstBatch && !existingImportLogId) {
      const { data: importLog, error: logError } = await supabaseAdmin
        .from('import_logs')
        .insert({
          import_type: 'distributor_supplier_portfolio',
          file_name: fileName || 'unknown',
          rows_processed: 0
        })
        .select('import_log_id')
        .single();

      if (logError) throw logError;
      importLogId = importLog.import_log_id;
    }

    let distributorsCreated = 0;
    let suppliersCreated = 0;
    let relationshipsCreated = 0;
    let relationshipsVerified = 0;
    let skipped = 0;
    const errors = [];
    const changes = [];
    
    // Pre-load all distributors, suppliers, and states
    let allDistributors = [];
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
        allDistributors = [...allDistributors, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    let allSuppliers = [];
    start = 0;
    hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_suppliers')
        .select('supplier_id, supplier_name')
        .range(start, start + pageSize - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allSuppliers = [...allSuppliers, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    const { data: allStates, error: statesError } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');
    
    if (statesError) throw statesError;
    
    // Build lookup maps
    const distributorMap = new Map(allDistributors?.map(d => [d.distributor_name, d]) || []);
    const supplierMap = new Map(allSuppliers?.map(s => [s.supplier_name, s]) || []);
    const stateCodeMap = new Map(allStates?.map(s => [s.state_code?.toLowerCase(), s]) || []);
    const stateNameMap = new Map(allStates?.map(s => [s.state_name?.toLowerCase(), s]) || []);
    
    console.log(`Loaded ${allDistributors?.length || 0} distributors, ${allSuppliers?.length || 0} suppliers, ${allStates?.length || 0} states`);
    
    const distributorsToCreate = [];
    const suppliersToCreate = [];
    const rowData = [];
    
    // Step 1: Process rows
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const distributorName = (row.distributor_name || '').trim();
      const supplierName = (row.supplier_name || '').trim();
      const stateName = (row.state_name || '').trim();
      const stateCode = (row.state_code || '').trim();

      if (!distributorName || !supplierName || (!stateName && !stateCode)) {
        skipped++;
        continue;
      }

      try {
        if (!distributorMap.has(distributorName) && !distributorsToCreate.some(d => d.name === distributorName)) {
          distributorsToCreate.push({ name: distributorName, row });
        }

        if (!supplierMap.has(supplierName) && !suppliersToCreate.some(s => s.name === supplierName)) {
          suppliersToCreate.push({ name: supplierName, row });
        }

        // Find states
        let stateIds = [];
        if (stateCode && stateCode.toUpperCase() === 'ALL') {
          stateIds = allStates?.map(s => s.state_id) || [];
        } else {
          let state = null;
          if (stateCode) {
            state = stateCodeMap.get(stateCode.toLowerCase());
          } else if (stateName) {
            state = stateNameMap.get(stateName.toLowerCase());
          }

          if (!state) {
            errors.push(`State not found: ${stateName || stateCode} (row: ${distributorName} - ${supplierName})`);
            skipped++;
            continue;
          }
          stateIds = [state.state_id];
        }

        rowData.push({ rowIndex, row, distributorName, supplierName, stateIds });
      } catch (rowError) {
        errors.push(`Error processing ${distributorName} - ${supplierName}: ${rowError.message}`);
        skipped++;
      }
    }

    // Step 2: Bulk create distributors
    if (distributorsToCreate.length > 0) {
      const { data: newDistributors, error: distributorError } = await supabaseAdmin
        .from('core_distributors')
        .insert(distributorsToCreate.map(d => ({ distributor_name: d.name })))
        .select('distributor_id, distributor_name');

      if (distributorError) throw distributorError;

      distributorsCreated += newDistributors?.length || 0;
      newDistributors?.forEach(d => distributorMap.set(d.distributor_name, d));

      newDistributors?.forEach((d, idx) => {
        changes.push({
          import_log_id: importLogId,
          change_type: 'distributor_created',
          entity_type: 'distributor',
          entity_id: d.distributor_id,
          entity_name: d.distributor_name,
          new_value: { distributor_name: d.distributor_name },
          source_row: distributorsToCreate[idx].row
        });
      });
    }

    // Step 3: Bulk create suppliers
    if (suppliersToCreate.length > 0) {
      const { data: newSuppliers, error: supplierError } = await supabaseAdmin
        .from('core_suppliers')
        .insert(suppliersToCreate.map(s => ({ supplier_name: s.name })))
        .select('supplier_id, supplier_name');

      if (supplierError) throw supplierError;

      suppliersCreated += newSuppliers?.length || 0;
      newSuppliers?.forEach(s => supplierMap.set(s.supplier_name, s));

      newSuppliers?.forEach((s, idx) => {
        changes.push({
          import_log_id: importLogId,
          change_type: 'supplier_created',
          entity_type: 'supplier',
          entity_id: s.supplier_id,
          entity_name: s.supplier_name,
          new_value: { supplier_name: s.supplier_name },
          source_row: suppliersToCreate[idx].row
        });
      });
    }

    // Step 4: Load existing relationships for all distributors
    const allDistributorIds = [...new Set(rowData.map(r => distributorMap.get(r.distributorName)?.distributor_id).filter(Boolean))];
    const existingRelsMap = new Map();
    
    if (allDistributorIds.length > 0) {
      let allExistingRels = [];
      start = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('distributor_supplier_state')
          .select('distributor_id, supplier_id, state_id')
          .in('distributor_id', allDistributorIds)
          .range(start, start + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allExistingRels = [...allExistingRels, ...data];
          start += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      allExistingRels?.forEach(rel => {
        existingRelsMap.set(`${rel.distributor_id}_${rel.supplier_id}_${rel.state_id}`, true);
      });
    }

    // Step 5: Prepare relationships to upsert
    const now = new Date().toISOString();
    const relationshipsToCreate = [];
    const relationshipsToUpdate = [];

    for (const { row, distributorName, supplierName, stateIds } of rowData) {
      const distributor = distributorMap.get(distributorName);
      const supplier = supplierMap.get(supplierName);

      if (!distributor) {
        errors.push(`Could not find distributor: ${distributorName}`);
        skipped++;
        continue;
      }
      
      if (!supplier) {
        errors.push(`Could not find supplier: ${supplierName}`);
        skipped++;
        continue;
      }

      for (const stateId of stateIds) {
        const relKey = `${distributor.distributor_id}_${supplier.supplier_id}_${stateId}`;
        
        if (existingRelsMap.has(relKey)) {
          relationshipsToUpdate.push({
            distributor_id: distributor.distributor_id,
            supplier_id: supplier.supplier_id,
            state_id: stateId
          });
        } else {
          relationshipsToCreate.push({
            distributor_id: distributor.distributor_id,
            supplier_id: supplier.supplier_id,
            state_id: stateId
          });
        }
      }
    }

    // Step 6: Bulk insert new relationships
    if (relationshipsToCreate.length > 0) {
      const { error: createError } = await supabaseAdmin
        .from('distributor_supplier_state')
        .insert(relationshipsToCreate);

      if (createError && createError.code !== '23505') {
        throw createError;
      }
      relationshipsCreated += relationshipsToCreate.length;
    }

    // Step 7: Count existing relationships as verified
    relationshipsVerified = relationshipsToUpdate.length;

    // Save changes
    if (changes.length > 0) {
      const { error: changesError } = await supabaseAdmin
        .from('import_changes')
        .insert(changes);

      if (changesError) {
        console.error('Error saving import changes:', changesError);
      }
    }

    // Update import log
    if (importLogId) {
      if (isLastBatch) {
        await supabaseAdmin
          .from('import_logs')
          .update({ status: errors.length > 0 ? 'partial' : 'completed' })
          .eq('import_log_id', importLogId);
      }
      
      const { data: currentLog } = await supabaseAdmin
        .from('import_logs')
        .select('suppliers_created, relationships_created, relationships_verified, rows_skipped, errors_count, rows_processed')
        .eq('import_log_id', importLogId)
        .single();
      
      if (currentLog) {
        await supabaseAdmin
          .from('import_logs')
          .update({
            suppliers_created: (currentLog.suppliers_created || 0) + distributorsCreated + suppliersCreated,
            relationships_created: (currentLog.relationships_created || 0) + relationshipsCreated,
            relationships_verified: (currentLog.relationships_verified || 0) + relationshipsVerified,
            rows_skipped: (currentLog.rows_skipped || 0) + skipped,
            errors_count: (currentLog.errors_count || 0) + errors.length,
            rows_processed: (currentLog.rows_processed || 0) + rows.length
          })
          .eq('import_log_id', importLogId);
      }
    }

    return NextResponse.json({
      distributorsCreated,
      suppliersCreated,
      relationshipsCreated,
      relationshipsVerified,
      skipped,
      errors: errors.slice(0, 20),
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

