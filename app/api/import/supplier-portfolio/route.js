import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows, confirmedMatches = {}, fileName } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Create import log entry
    const { data: importLog, error: logError } = await supabaseAdmin
      .from('import_logs')
      .insert({
        import_type: 'supplier_portfolio',
        file_name: fileName || 'unknown',
        rows_processed: rows.length
      })
      .select('import_log_id')
      .single();

    if (logError) throw logError;
    const importLogId = importLog.import_log_id;

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
        // 1. Get or create supplier
        let supplier = await supabaseAdmin
          .from('core_suppliers')
          .select('supplier_id')
          .eq('supplier_name', supplierName)
          .maybeSingle();

        if (supplier.error) throw supplier.error;

        if (!supplier.data) {
          const newSupplier = await supabaseAdmin
            .from('core_suppliers')
            .insert({ supplier_name: supplierName })
            .select('supplier_id')
            .single();

          if (newSupplier.error) throw newSupplier.error;
          supplier.data = newSupplier.data;
          suppliersCreated++;
          
          // Log supplier creation
          changes.push({
            import_log_id: importLogId,
            change_type: 'supplier_created',
            entity_type: 'supplier',
            entity_id: newSupplier.data.supplier_id,
            entity_name: supplierName,
            new_value: { supplier_name: supplierName },
            source_row: row
          });
        }

        const supplierId = supplier.data.supplier_id;

        // 2. Get or create brand (with fuzzy match support)
        let brandId;
        
        // Check if user confirmed to use an existing brand via fuzzy match
        if (confirmedMatches[rowIndex] && confirmedMatches[rowIndex].useExisting) {
          brandId = confirmedMatches[rowIndex].existingBrandId;
        } else {
          // Normal brand lookup or creation
          let brand = await supabaseAdmin
            .from('core_brands')
            .select('brand_id')
            .eq('brand_name', brandName)
            .maybeSingle();

          if (brand.error) throw brand.error;

          if (!brand.data) {
            const newBrand = await supabaseAdmin
              .from('core_brands')
              .insert({ brand_name: brandName })
              .select('brand_id')
              .single();

            if (newBrand.error) throw newBrand.error;
            brand.data = newBrand.data;
            brandsCreated++;
            
            // Log brand creation
            changes.push({
              import_log_id: importLogId,
              change_type: 'brand_created',
              entity_type: 'brand',
              entity_id: newBrand.data.brand_id,
              entity_name: brandName,
              new_value: { brand_name: brandName },
              source_row: row
            });
          }

          brandId = brand.data.brand_id;
        }

        // 3. Get state(s) - handle "ALL" special case
        let stateIds = [];
        
        if (stateCode && stateCode.toUpperCase() === 'ALL') {
          // Fetch all states
          const allStates = await supabaseAdmin
            .from('core_states')
            .select('state_id');

          if (allStates.error) throw allStates.error;
          stateIds = allStates.data.map(s => s.state_id);
        } else {
          // Single state lookup
          let state;
          if (stateCode) {
            state = await supabaseAdmin
              .from('core_states')
              .select('state_id')
              .eq('state_code', stateCode.toUpperCase())
              .maybeSingle();
          } else {
            state = await supabaseAdmin
              .from('core_states')
              .select('state_id')
              .ilike('state_name', stateName)
              .maybeSingle();
          }

          if (state.error) throw state.error;

          if (!state.data) {
            errors.push(`State not found: ${stateName || stateCode} (row: ${supplierName} - ${brandName})`);
            skipped++;
            continue;
          }

          stateIds = [state.data.state_id];
        }

        // Track this supplier's imported relationships
        if (!importedRelationships.has(supplierId)) {
          importedRelationships.set(supplierId, new Set());
        }

        // 4. Create relationships for each state
        for (const stateId of stateIds) {
          // Track this relationship as imported
          importedRelationships.get(supplierId).add(`${brandId}:${stateId}`);

          const existing = await supabaseAdmin
            .from('brand_supplier_state')
            .select('brand_id')
            .eq('brand_id', brandId)
            .eq('supplier_id', supplierId)
            .eq('state_id', stateId)
            .maybeSingle();

          if (existing.error) throw existing.error;

          if (!existing.data) {
            const relationship = await supabaseAdmin
              .from('brand_supplier_state')
              .insert({
                brand_id: brandId,
                supplier_id: supplierId,
                state_id: stateId,
                is_verified: true,
                last_verified_at: new Date().toISOString(),
                relationship_source: 'csv_import'
              });

            if (relationship.error) throw relationship.error;
            relationshipsCreated++;
            
            // Log relationship creation
            changes.push({
              import_log_id: importLogId,
              change_type: 'relationship_created',
              entity_type: 'relationship',
              entity_id: brandId,
              entity_name: `${supplierName} → ${brandName}`,
              new_value: { brand_id: brandId, supplier_id: supplierId, state_id: stateId },
              source_row: row
            });
          } else {
            // Update existing relationship to mark as verified with current timestamp
            const updateRel = await supabaseAdmin
              .from('brand_supplier_state')
              .update({
                is_verified: true,
                last_verified_at: new Date().toISOString(),
                relationship_source: 'csv_import'
              })
              .eq('brand_id', brandId)
              .eq('supplier_id', supplierId)
              .eq('state_id', stateId);

            if (updateRel.error) throw updateRel.error;
            relationshipsVerified++;
            
            // Log relationship re-verification
            changes.push({
              import_log_id: importLogId,
              change_type: 'relationship_verified',
              entity_type: 'relationship',
              entity_id: brandId,
              entity_name: `${supplierName} → ${brandName}`,
              new_value: { verified_at: new Date().toISOString() },
              source_row: row
            });
          }
        }

      } catch (rowError) {
        errors.push(`Error processing ${supplierName} - ${brandName}: ${rowError.message}`);
        skipped++;
      }
    }

    // 5. Handle orphaned relationships (existing in DB but not in import)
    for (const [supplierId, importedSet] of importedRelationships.entries()) {
      try {
        // Get all existing relationships for this supplier
        const { data: existingRels, error: existingError } = await supabaseAdmin
          .from('brand_supplier_state')
          .select('brand_id, state_id, is_verified, last_verified_at, relationship_source')
          .eq('supplier_id', supplierId);

        if (existingError) throw existingError;

        // Find relationships that exist in DB but not in import
        for (const rel of existingRels) {
          const relKey = `${rel.brand_id}:${rel.state_id}`;
          
          if (!importedSet.has(relKey)) {
            // This relationship is orphaned - move to core_orphans
            const orphanInsert = await supabaseAdmin
              .from('core_orphans')
              .insert({
                brand_id: rel.brand_id,
                supplier_id: supplierId,
                state_id: rel.state_id,
                was_verified: rel.is_verified,
                last_verified_at: rel.last_verified_at,
                relationship_source: rel.relationship_source,
                reason: 'not_in_import'
              });

            if (orphanInsert.error) throw orphanInsert.error;

            // Delete from active relationships
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

    // Save all changes to import_changes table
    if (changes.length > 0) {
      const { error: changesError } = await supabaseAdmin
        .from('import_changes')
        .insert(changes);

      if (changesError) {
        console.error('Error saving import changes:', changesError);
      }
    }

    // Update import log with final counts
    await supabaseAdmin
      .from('import_logs')
      .update({
        suppliers_created: suppliersCreated,
        brands_created: brandsCreated,
        relationships_created: relationshipsCreated,
        relationships_verified: relationshipsVerified,
        relationships_orphaned: relationshipsOrphaned,
        rows_skipped: skipped,
        errors_count: errors.length,
        status: errors.length > 0 ? 'partial' : 'completed'
      })
      .eq('import_log_id', importLogId);

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

