import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { 
      rows, 
      confirmedMatches = {}, 
      fileName,
      isFirstBatch = true,
      isLastBatch = true,
      existingImportLogId = null,
      verifyRelationships = false
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
          import_type: 'distributor_portfolio',
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
    
    // Track which distributor-supplier-state combos are in the import
    const importedRelationships = new Map(); // Map<distributorId, Map<supplierId, Set<stateId>>>
    
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
    const distributorIdMap = new Map(allDistributors?.map(d => [d.distributor_id, d]) || []);
    const supplierIdMap = new Map(allSuppliers?.map(s => [s.supplier_id, s]) || []);
    
    console.log(`Loaded ${allDistributors?.length || 0} distributors, ${allSuppliers?.length || 0} suppliers, ${allStates?.length || 0} states`);
    
    // Collect items to create
    const distributorsToCreate = [];
    const suppliersToCreate = [];
    const rowData = [];
    
    // Step 1: Process rows and identify what needs to be created
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
        // Find or queue distributor creation (respect user overrides)
        let targetDistributorName = distributorName;
        const distributorMatchKey = `${distributorName}|${supplierName}|${rowIndex}`;
        if (confirmedMatches[rowIndex] && confirmedMatches[rowIndex].useExistingDistributor) {
          const matchId = confirmedMatches[rowIndex].existingDistributorId;
          const existingDistributor = distributorIdMap.get(matchId);
          
          if (existingDistributor) {
            targetDistributorName = existingDistributor.distributor_name;
          } else {
            console.error(`Distributor ID ${matchId} not found!`);
            errors.push(`Warning: Could not find confirmed distributor match for ${distributorName}. Creating new distributor.`);
            targetDistributorName = distributorName;
          }
        }
        
        if (!distributorMap.has(targetDistributorName) && !distributorsToCreate.some(d => d.name === targetDistributorName)) {
          distributorsToCreate.push({ name: targetDistributorName, row });
        }

        // Find or queue supplier creation (respect user overrides)
        let targetSupplierName = supplierName;
        if (confirmedMatches[rowIndex] && confirmedMatches[rowIndex].useExistingSupplier) {
          const matchId = confirmedMatches[rowIndex].existingSupplierId;
          const existingSupplier = supplierIdMap.get(matchId);
          
          if (existingSupplier) {
            targetSupplierName = existingSupplier.supplier_name;
          } else {
            console.error(`Supplier ID ${matchId} not found!`);
            errors.push(`Warning: Could not find confirmed supplier match for ${supplierName}. Creating new supplier.`);
            targetSupplierName = supplierName;
          }
        }
        
        if (!supplierMap.has(targetSupplierName) && !suppliersToCreate.some(s => s.name === targetSupplierName)) {
          suppliersToCreate.push({ name: targetSupplierName, row });
        }

        // Find states
        let stateIds = [];
        if (stateCode && stateCode.toUpperCase() === 'ALL') {
          stateIds = allStates?.map(s => s.state_id) || [];
        } else {
          // Handle comma-separated state codes
          const stateCodesToCheck = stateCode ? stateCode.split(',').map(s => s.trim()) : [];
          const stateNamesToCheck = stateName ? stateName.split(',').map(s => s.trim()) : [];
          
          const allStatesToCheck = [...stateCodesToCheck, ...stateNamesToCheck];
          const foundStates = [];

          for (const stateToCheck of allStatesToCheck) {
            if (stateToCheck) {
              const state = allStates?.find(s => 
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

        if (stateIds.length === 0) {
          errors.push(`No valid states found for ${distributorName} - ${supplierName}`);
          skipped++;
          continue;
        }

        rowData.push({ 
          rowIndex, 
          row, 
          distributorName: targetDistributorName, 
          supplierName: targetSupplierName,
          stateIds 
        });
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
      newDistributors?.forEach(d => {
        distributorMap.set(d.distributor_name, d);
        distributorIdMap.set(d.distributor_id, d);
      });

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
      newSuppliers?.forEach(s => {
        supplierMap.set(s.supplier_name, s);
        supplierIdMap.set(s.supplier_id, s);
      });

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
    const existingRelsMap = new Map(); // Map<distributorId_supplierId_stateId, true>
    
    if (allDistributorIds.length > 0) {
      const { data: existingRels } = await supabaseAdmin
        .from('distributor_supplier_state')
        .select('distributor_id, supplier_id, state_id')
        .in('distributor_id', allDistributorIds);

      existingRels?.forEach(rel => {
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

      // Track imported relationships
      if (!importedRelationships.has(distributor.distributor_id)) {
        importedRelationships.set(distributor.distributor_id, new Map());
      }
      if (!importedRelationships.get(distributor.distributor_id).has(supplier.supplier_id)) {
        importedRelationships.get(distributor.distributor_id).set(supplier.supplier_id, new Set());
      }

      for (const stateId of stateIds) {
        const relKey = `${distributor.distributor_id}_${supplier.supplier_id}_${stateId}`;
        
        if (existingRelsMap.has(relKey)) {
          relationshipsToUpdate.push({
            distributor_id: distributor.distributor_id,
            supplier_id: supplier.supplier_id,
            state_id: stateId,
            is_verified: verifyRelationships,
            last_verified_at: verifyRelationships ? now : null
          });
        } else {
          relationshipsToCreate.push({
            distributor_id: distributor.distributor_id,
            supplier_id: supplier.supplier_id,
            state_id: stateId,
            is_verified: verifyRelationships,
            last_verified_at: verifyRelationships ? now : null
          });
        }

        // Track this relationship as imported
        importedRelationships.get(distributor.distributor_id).get(supplier.supplier_id).add(stateId);
      }
    }

    // Step 6: Bulk upsert relationships
    if (relationshipsToCreate.length > 0) {
      const { error: createError } = await supabaseAdmin
        .from('distributor_supplier_state')
        .insert(relationshipsToCreate);

      if (createError) throw createError;

      relationshipsCreated += relationshipsToCreate.length;

      relationshipsToCreate.forEach(rel => {
        changes.push({
          import_log_id: importLogId,
          change_type: 'relationship_created',
          entity_type: 'distributor_supplier_state',
          entity_id: `${rel.distributor_id}_${rel.supplier_id}_${rel.state_id}`,
          entity_name: `${distributorMap.get(rel.distributor_id)?.distributor_name} → ${supplierMap.get(rel.supplier_id)?.supplier_name} (${allStates?.find(s => s.state_id === rel.state_id)?.state_name})`,
          new_value: rel,
          source_row: null
        });
      });
    }

    if (relationshipsToUpdate.length > 0) {
      for (const rel of relationshipsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('distributor_supplier_state')
          .update({
            is_verified: verifyRelationships,
            last_verified_at: verifyRelationships ? now : null
          })
          .eq('distributor_id', rel.distributor_id)
          .eq('supplier_id', rel.supplier_id)
          .eq('state_id', rel.state_id);

        if (updateError) throw updateError;
      }

      relationshipsVerified += relationshipsToUpdate.length;

      relationshipsToUpdate.forEach(rel => {
        changes.push({
          import_log_id: importLogId,
          change_type: 'relationship_updated',
          entity_type: 'distributor_supplier_state',
          entity_id: `${rel.distributor_id}_${rel.supplier_id}_${rel.state_id}`,
          entity_name: `${distributorMap.get(rel.distributor_id)?.distributor_name} → ${supplierMap.get(rel.supplier_id)?.supplier_name} (${allStates?.find(s => s.state_id === rel.state_id)?.state_name})`,
          new_value: rel,
          source_row: null
        });
      });
    }

    // Step 7: Save all changes to import_log_details
    if (changes.length > 0) {
      const { error: detailsError } = await supabaseAdmin
        .from('import_log_details')
        .insert(changes);

      if (detailsError) {
        console.error('Error saving import log details:', detailsError);
        // Don't throw - this is not critical
      }
    }

    // Step 8: Update import log with final counts
    const totalRowsProcessed = rowData.length;
    const { error: updateLogError } = await supabaseAdmin
      .from('import_logs')
      .update({ rows_processed: totalRowsProcessed })
      .eq('import_log_id', importLogId);

    if (updateLogError) {
      console.error('Error updating import log:', updateLogError);
      // Don't throw - this is not critical
    }

    return NextResponse.json({
      distributorsCreated,
      suppliersCreated,
      relationshipsCreated,
      relationshipsVerified,
      skipped,
      errors,
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}