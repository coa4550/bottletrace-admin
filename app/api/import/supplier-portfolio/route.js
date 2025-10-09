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
          import_type: 'supplier_portfolio',
          file_name: fileName || 'unknown',
          rows_processed: 0 // Will update at the end
        })
        .select('import_log_id')
        .single();

      if (logError) throw logError;
      importLogId = importLog.import_log_id;
    }

    let suppliersCreated = 0;
    let brandsCreated = 0;
    let relationshipsCreated = 0;
    let relationshipsVerified = 0;
    let relationshipsOrphaned = 0;
    let skipped = 0;
    const errors = [];
    const changes = []; // Track all changes for batch insert
    
    // Track which supplier-brand-state combos are in the import
    const importedRelationships = new Map(); // Map<supplierId, Set<brandId-stateId>>
    
    // Pre-load all suppliers, brands, and states for this batch to avoid repeated queries
    const { data: allSuppliers, error: suppliersError } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name');
    
    if (suppliersError) throw suppliersError;
    
    const { data: allBrands, error: brandsError } = await supabaseAdmin
      .from('core_brands')
      .select('brand_id, brand_name');
    
    if (brandsError) throw brandsError;
    
    const { data: allStates, error: statesError } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');
    
    if (statesError) throw statesError;
    
    // Build lookup maps
    const supplierMap = new Map(allSuppliers?.map(s => [s.supplier_name, s]) || []);
    const brandMap = new Map(allBrands?.map(b => [b.brand_name, b]) || []);
    const brandIdMap = new Map(allBrands?.map(b => [b.brand_id, b]) || []); // Map by ID for confirmed matches
    const stateCodeMap = new Map(allStates?.map(s => [s.state_code?.toLowerCase(), s]) || []);
    const stateNameMap = new Map(allStates?.map(s => [s.state_name?.toLowerCase(), s]) || []);
    
    // Collect all items to create in bulk
    const suppliersToCreate = [];
    const brandsToCreate = [];
    const relationshipsToUpsert = [];

    // Step 1: First pass - identify new suppliers and brands, collect relationships
    const rowData = []; // Store processed row data
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const supplierName = (row.supplier_name || '').trim();
      const brandName = (row.brand_name || '').trim();
      const stateName = (row.state_name || '').trim();
      const stateCode = (row.state_code || '').trim();

      if (!supplierName || !brandName || (!stateName && !stateCode)) {
        skipped++;
        continue;
      }

      try {
        // Find or queue supplier creation
        if (!supplierMap.has(supplierName) && !suppliersToCreate.some(s => s.name === supplierName)) {
          suppliersToCreate.push({ name: supplierName, row });
        }

        // Find or queue brand creation (respect user overrides)
        let targetBrandName = brandName;
        if (confirmedMatches[rowIndex] && confirmedMatches[rowIndex].useExisting) {
          // User manually selected an existing brand - look it up by ID
          const existingBrand = brandIdMap.get(confirmedMatches[rowIndex].existingBrandId);
          if (existingBrand) {
            targetBrandName = existingBrand.brand_name;
          } else {
            // Fallback: try to find by name in case of mismatch
            errors.push(`Warning: Could not find confirmed brand match for ${brandName} (ID: ${confirmedMatches[rowIndex].existingBrandId}). Creating new brand.`);
            targetBrandName = brandName;
          }
        }
        
        // Queue for creation if needed (and not already confirmed to exist)
        if (!brandMap.has(targetBrandName) && !brandsToCreate.some(b => b.name === targetBrandName)) {
          brandsToCreate.push({ name: targetBrandName, row });
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
            errors.push(`State not found: ${stateName || stateCode} (row: ${supplierName} - ${brandName})`);
            skipped++;
            continue;
          }
          stateIds = [state.state_id];
        }

        rowData.push({ rowIndex, row, supplierName, brandName: targetBrandName, stateIds });
      } catch (rowError) {
        errors.push(`Error processing ${supplierName} - ${brandName}: ${rowError.message}`);
        skipped++;
      }
    }

    // Step 2: Bulk create suppliers
    if (suppliersToCreate.length > 0) {
      const { data: newSuppliers, error: supplierError } = await supabaseAdmin
        .from('core_suppliers')
        .insert(suppliersToCreate.map(s => ({ supplier_name: s.name })))
        .select('supplier_id, supplier_name');

      if (supplierError) throw supplierError;

      suppliersCreated += newSuppliers?.length || 0;
      newSuppliers?.forEach(s => supplierMap.set(s.supplier_name, s));

      // Log supplier creations
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

    // Step 3: Bulk create brands
    if (brandsToCreate.length > 0) {
      const { data: newBrands, error: brandError } = await supabaseAdmin
        .from('core_brands')
        .insert(brandsToCreate.map(b => ({ brand_name: b.name })))
        .select('brand_id, brand_name');

      if (brandError) throw brandError;

      brandsCreated += newBrands?.length || 0;
      newBrands?.forEach(b => {
        brandMap.set(b.brand_name, b);
        brandIdMap.set(b.brand_id, b);
      });

      // Log brand creations
      newBrands?.forEach((b, idx) => {
        changes.push({
          import_log_id: importLogId,
          change_type: 'brand_created',
          entity_type: 'brand',
          entity_id: b.brand_id,
          entity_name: b.brand_name,
          new_value: { brand_name: b.brand_name },
          source_row: brandsToCreate[idx].row
        });
      });
    }

    // Step 4: Load existing relationships for all suppliers to check what exists
    const allSupplierIds = [...new Set(rowData.map(r => supplierMap.get(r.supplierName)?.supplier_id).filter(Boolean))];
    const existingRelsMap = new Map(); // Map<supplierId_brandId_stateId, true>
    
    if (allSupplierIds.length > 0) {
      const { data: existingRels } = await supabaseAdmin
        .from('brand_supplier_state')
        .select('brand_id, supplier_id, state_id')
        .in('supplier_id', allSupplierIds);

      existingRels?.forEach(rel => {
        existingRelsMap.set(`${rel.supplier_id}_${rel.brand_id}_${rel.state_id}`, true);
      });
    }

    // Step 5: Prepare relationships to upsert
    const now = new Date().toISOString();
    const relationshipsToCreate = [];
    const relationshipsToUpdate = [];

    for (const { row, supplierName, brandName, stateIds } of rowData) {
      const supplier = supplierMap.get(supplierName);
      const brand = brandMap.get(brandName);

      if (!supplier) {
        errors.push(`Could not find supplier in map: ${supplierName} (for brand: ${brandName})`);
        skipped++;
        continue;
      }
      
      if (!brand) {
        errors.push(`Could not find brand in map: ${brandName} (for supplier: ${supplierName}). Available brands: ${Array.from(brandMap.keys()).filter(k => k.toLowerCase().includes(brandName.toLowerCase().substring(0, 3))).join(', ')}`);
        skipped++;
        continue;
      }

      // Track imported relationships
      if (!importedRelationships.has(supplier.supplier_id)) {
        importedRelationships.set(supplier.supplier_id, new Set());
      }

      for (const stateId of stateIds) {
        importedRelationships.get(supplier.supplier_id).add(`${brand.brand_id}:${stateId}`);

        const relKey = `${supplier.supplier_id}_${brand.brand_id}_${stateId}`;
        
        if (existingRelsMap.has(relKey)) {
          // Will update
          relationshipsToUpdate.push({
            brand_id: brand.brand_id,
            supplier_id: supplier.supplier_id,
            state_id: stateId
          });
        } else {
          // Will create
          relationshipsToCreate.push({
            brand_id: brand.brand_id,
            supplier_id: supplier.supplier_id,
            state_id: stateId,
            is_verified: true,
            last_verified_at: now,
            relationship_source: 'csv_import'
          });
        }
      }
    }

    // Step 6: Bulk insert new relationships
    if (relationshipsToCreate.length > 0) {
      const { error: createError } = await supabaseAdmin
        .from('brand_supplier_state')
        .insert(relationshipsToCreate);

      if (createError) {
        // If duplicate key error, that's okay - they already exist
        if (createError.code !== '23505') {
          throw createError;
        }
      }
      relationshipsCreated += relationshipsToCreate.length;
    }

    // Step 7: Bulk update existing relationships (use upsert)
    if (relationshipsToUpdate.length > 0) {
      for (const rel of relationshipsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('brand_supplier_state')
          .update({
            is_verified: true,
            last_verified_at: now,
            relationship_source: 'csv_import'
          })
          .eq('brand_id', rel.brand_id)
          .eq('supplier_id', rel.supplier_id)
          .eq('state_id', rel.state_id);

        if (updateError) throw updateError;
        relationshipsVerified++;
      }
    }

    // 5. Handle orphaned relationships (existing in DB but not in import) - only on last batch
    if (isLastBatch) {
      for (const [supplierId, importedSet] of importedRelationships.entries()) {
        try {
          // Get all existing relationships for this supplier
          const { data: existingRels, error: existingError } = await supabaseAdmin
            .from('brand_supplier_state')
            .select('brand_id, state_id, is_verified, last_verified_at, relationship_source')
            .eq('supplier_id', supplierId);

          if (existingError) throw existingError;

          // Collect orphaned relationships for batch delete
          const orphanedRels = [];
          const orphanRecords = [];
          
          for (const rel of existingRels) {
            const relKey = `${rel.brand_id}:${rel.state_id}`;
            
            if (!importedSet.has(relKey)) {
              orphanedRels.push(rel);
              orphanRecords.push({
                brand_id: rel.brand_id,
                supplier_id: supplierId,
                state_id: rel.state_id,
                was_verified: rel.is_verified,
                last_verified_at: rel.last_verified_at,
                relationship_source: rel.relationship_source,
                reason: 'not_in_import'
              });
            }
          }

          // Bulk insert orphans (fail gracefully if table doesn't exist)
          if (orphanRecords.length > 0) {
            try {
              const orphanInsert = await supabaseAdmin
                .from('core_orphans')
                .insert(orphanRecords);

              if (orphanInsert.error && orphanInsert.error.code !== '42P01') { // Not "table doesn't exist"
                throw orphanInsert.error;
              }
            } catch (orphanInsertError) {
              console.warn('Could not insert into core_orphans (table may not exist):', orphanInsertError.message);
              // Continue anyway - don't fail the whole import
            }

            // Bulk delete orphaned relationships
            for (const rel of orphanedRels) {
              const deleteRel = await supabaseAdmin
                .from('brand_supplier_state')
                .delete()
                .eq('brand_id', rel.brand_id)
                .eq('supplier_id', supplierId)
                .eq('state_id', rel.state_id);

              if (deleteRel.error) throw deleteRel.error;

              relationshipsOrphaned++;
              
              // Log relationship orphaning
              changes.push({
                import_log_id: importLogId,
                change_type: 'relationship_orphaned',
                entity_type: 'relationship',
                entity_id: rel.brand_id,
                entity_name: `Supplier ${supplierId} → Brand ${rel.brand_id}`,
                old_value: { 
                  brand_id: rel.brand_id, 
                  supplier_id: supplierId, 
                  state_id: rel.state_id,
                  was_verified: rel.is_verified,
                  last_verified_at: rel.last_verified_at
                },
                source_row: { reason: 'not_in_import' }
              });
            }
          }
        } catch (orphanError) {
          errors.push(`Error handling orphaned relationships: ${orphanError.message}`);
        }
      }
    }

    // Save all changes to import_changes table
    if (changes.length > 0) {
      const { error: changesError } = await supabaseAdmin
        .from('import_changes')
        .insert(changes);

      if (changesError) {
        console.error('Error saving import changes:', changesError);
      }
    }

    // Update import log with counts (incremental for batches)
    if (importLogId) {
      if (isLastBatch) {
        // Final update with status
        await supabaseAdmin
          .from('import_logs')
          .update({
            status: errors.length > 0 ? 'partial' : 'completed'
          })
          .eq('import_log_id', importLogId);
      }
      
      // Always increment the counts
      const { data: currentLog } = await supabaseAdmin
        .from('import_logs')
        .select('suppliers_created, brands_created, relationships_created, relationships_verified, relationships_orphaned, rows_skipped, errors_count, rows_processed')
        .eq('import_log_id', importLogId)
        .single();
      
      if (currentLog) {
        await supabaseAdmin
          .from('import_logs')
          .update({
            suppliers_created: (currentLog.suppliers_created || 0) + suppliersCreated,
            brands_created: (currentLog.brands_created || 0) + brandsCreated,
            relationships_created: (currentLog.relationships_created || 0) + relationshipsCreated,
            relationships_verified: (currentLog.relationships_verified || 0) + relationshipsVerified,
            relationships_orphaned: (currentLog.relationships_orphaned || 0) + relationshipsOrphaned,
            rows_skipped: (currentLog.rows_skipped || 0) + skipped,
            errors_count: (currentLog.errors_count || 0) + errors.length,
            rows_processed: (currentLog.rows_processed || 0) + rows.length
          })
          .eq('import_log_id', importLogId);
      }
    }

    return NextResponse.json({
      suppliersCreated,
      brandsCreated,
      relationshipsCreated,
      relationshipsVerified,
      relationshipsOrphaned,
      skipped,
      errors: errors.slice(0, 10), // Limit to first 10 errors
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

