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
      verifyRelationships = true
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
          rows_processed: 0
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
    const changes = [];
    
    // Track which brand-supplier combos are in the import
    const importedRelationships = new Map(); // Map<supplierId, Set<brandId>>
    
    // Pre-load all suppliers and brands
    let allSuppliers = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;
    
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
    
    let allBrands = [];
    start = 0;
    hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('core_brands')
        .select('brand_id, brand_name')
        .range(start, start + pageSize - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allBrands = [...allBrands, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    // Build lookup maps
    const supplierMap = new Map(allSuppliers?.map(s => [s.supplier_name, s]) || []);
    const brandMap = new Map(allBrands?.map(b => [b.brand_name, b]) || []);
    const brandIdMap = new Map(allBrands?.map(b => [b.brand_id, b]) || []);
    
    console.log(`Loaded ${allBrands?.length || 0} brands, ${allSuppliers?.length || 0} suppliers`);
    
    // Collect items to create
    const suppliersToCreate = [];
    const brandsToCreate = [];
    const rowData = [];
    
    // Step 1: Process rows and identify what needs to be created
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const supplierName = (row.supplier_name || '').trim();
      const brandName = (row.brand_name || '').trim();

      if (!supplierName || !brandName) {
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
          const matchId = confirmedMatches[rowIndex].existingBrandId;
          const existingBrand = brandIdMap.get(matchId);
          
          if (existingBrand) {
            targetBrandName = existingBrand.brand_name;
          } else {
            console.error(`Brand ID ${matchId} not found!`);
            errors.push(`Warning: Could not find confirmed brand match for ${brandName}. Creating new brand.`);
            targetBrandName = brandName;
          }
        }
        
        if (!brandMap.has(targetBrandName) && !brandsToCreate.some(b => b.name === targetBrandName)) {
          brandsToCreate.push({ name: targetBrandName, row });
        }

        rowData.push({ rowIndex, row, supplierName, brandName: targetBrandName });
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

    // Step 4: Load existing relationships for all suppliers
    const allSupplierIds = [...new Set(rowData.map(r => supplierMap.get(r.supplierName)?.supplier_id).filter(Boolean))];
    const existingRelsMap = new Map(); // Map<supplierId_brandId, true>
    
    if (allSupplierIds.length > 0) {
      const { data: existingRels } = await supabaseAdmin
        .from('brand_supplier')
        .select('brand_id, supplier_id')
        .in('supplier_id', allSupplierIds);

      existingRels?.forEach(rel => {
        existingRelsMap.set(`${rel.supplier_id}_${rel.brand_id}`, true);
      });
    }

    // Step 5: Prepare relationships to upsert
    const now = new Date().toISOString();
    const relationshipsToCreate = [];
    const relationshipsToUpdate = [];

    for (const { row, supplierName, brandName } of rowData) {
      const supplier = supplierMap.get(supplierName);
      const brand = brandMap.get(brandName);

      if (!supplier) {
        errors.push(`Could not find supplier: ${supplierName}`);
        skipped++;
        continue;
      }
      
      if (!brand) {
        errors.push(`Could not find brand: ${brandName}`);
        skipped++;
        continue;
      }

      // Track imported relationships
      if (!importedRelationships.has(supplier.supplier_id)) {
        importedRelationships.set(supplier.supplier_id, new Set());
      }
      importedRelationships.get(supplier.supplier_id).add(brand.brand_id);

      const relKey = `${supplier.supplier_id}_${brand.brand_id}`;
      
      if (existingRelsMap.has(relKey)) {
        relationshipsToUpdate.push({
          brand_id: brand.brand_id,
          supplier_id: supplier.supplier_id
        });
      } else {
        relationshipsToCreate.push({
          brand_id: brand.brand_id,
          supplier_id: supplier.supplier_id,
          is_verified: verifyRelationships,
          last_verified_at: verifyRelationships ? now : null,
          relationship_source: 'csv_import'
        });
      }
    }

    // Step 6: Bulk insert new relationships
    if (relationshipsToCreate.length > 0) {
      const { error: createError } = await supabaseAdmin
        .from('brand_supplier')
        .insert(relationshipsToCreate);

      if (createError && createError.code !== '23505') {
        throw createError;
      }
      relationshipsCreated += relationshipsToCreate.length;
    }

    // Step 7: Bulk update existing relationships
    if (relationshipsToUpdate.length > 0) {
      for (const rel of relationshipsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('brand_supplier')
          .update({
            is_verified: verifyRelationships,
            last_verified_at: verifyRelationships ? now : null,
            relationship_source: 'csv_import'
          })
          .eq('brand_id', rel.brand_id)
          .eq('supplier_id', rel.supplier_id);

        if (updateError) throw updateError;
        if (verifyRelationships) {
          relationshipsVerified++;
        }
      }
    }

    // Step 8: Handle orphaned relationships
    // NOTE: Orphaning is disabled for batched imports because each batch only knows about its own brands
    // To enable orphaning, you would need to pass ALL imported brands across all batches
    // For now, orphans must be handled manually via the Orphans audit page
    // if (isLastBatch) {
    //   // Orphaning logic disabled in batched imports
    // }

    // Save all changes to import_changes table
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
      errors: errors.slice(0, 20),
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
