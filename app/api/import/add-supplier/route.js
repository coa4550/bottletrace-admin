import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows, confirmedMatches, fileName, isFirstBatch, isLastBatch, existingImportLogId } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    let importLogId = existingImportLogId;

    // Create import log on first batch
    if (isFirstBatch && !importLogId) {
      const { data: logData, error: logError } = await supabaseAdmin
        .from('import_logs')
        .insert({
          import_type: 'add_supplier',
          file_name: fileName || 'unknown.csv',
          status: 'in_progress',
          rows_processed: 0
        })
        .select()
        .single();

      if (logError) throw logError;
      importLogId = logData.import_log_id;
    }

    let suppliersCreated = 0;
    let suppliersUpdated = 0;
    let skipped = 0;
    const errors = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const match = confirmedMatches?.[i];
      
      try {
        const supplierName = (row.supplier_name || '').trim();
        
        if (!supplierName) {
          skipped++;
          continue;
        }

        const supplierUrl = (row.supplier_url || '').trim();
        const supplierLogoUrl = (row.supplier_logo_url || '').trim();

        let supplierId;
        let wasCreated = false;
        let wasUpdated = false;

        // Check if user wants to use existing supplier or create new
        if (match?.useExisting && match?.existingSupplierId) {
          // Use existing supplier - enrich it with new data
          supplierId = match.existingSupplierId;
          
          // Fetch existing supplier to check what fields are empty
          const { data: existingSupplier, error: fetchError } = await supabaseAdmin
            .from('core_suppliers')
            .select('supplier_url, supplier_logo_url')
            .eq('supplier_id', supplierId)
            .single();

          if (fetchError) throw fetchError;

          // Only update fields that are currently null/empty in the database
          const updateData = {};
          if (supplierUrl && !existingSupplier.supplier_url) {
            updateData.supplier_url = supplierUrl;
          }
          if (supplierLogoUrl && !existingSupplier.supplier_logo_url) {
            updateData.supplier_logo_url = supplierLogoUrl;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from('core_suppliers')
              .update(updateData)
              .eq('supplier_id', supplierId);

            if (updateError) throw updateError;
            wasUpdated = true;
            suppliersUpdated++;

            // Log the enrichment
            await supabaseAdmin
              .from('import_changes')
              .insert({
                import_log_id: importLogId,
                change_type: 'enriched',
                entity_type: 'supplier',
                entity_id: supplierId,
                entity_name: supplierName,
                old_value: existingSupplier,
                new_value: updateData,
                source_row: row
              });
          }

        } else {
          // Create new supplier
          const { data: newSupplier, error: supplierError } = await supabaseAdmin
            .from('core_suppliers')
            .insert({
              supplier_name: supplierName,
              supplier_url: supplierUrl || null,
              supplier_logo_url: supplierLogoUrl || null
            })
            .select()
            .single();

          if (supplierError) {
            // Check if it's a duplicate error
            if (supplierError.code === '23505') {
              // Supplier already exists, fetch it
              const { data: existingSupplier } = await supabaseAdmin
                .from('core_suppliers')
                .select('supplier_id')
                .eq('supplier_name', supplierName)
                .single();
              
              if (existingSupplier) {
                supplierId = existingSupplier.supplier_id;
                skipped++;
              } else {
                throw supplierError;
              }
            } else {
              throw supplierError;
            }
          } else {
            supplierId = newSupplier.supplier_id;
            wasCreated = true;
            suppliersCreated++;

            // Log the creation
            await supabaseAdmin
              .from('import_changes')
              .insert({
                import_log_id: importLogId,
                change_type: 'created',
                entity_type: 'supplier',
                entity_id: supplierId,
                entity_name: supplierName,
                new_value: { 
                  supplier_name: supplierName,
                  supplier_url: supplierUrl,
                  supplier_logo_url: supplierLogoUrl
                },
                source_row: row
              });
          }
        }

      } catch (error) {
        console.error(`Error processing row ${i}:`, error);
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Update import log on last batch
    if (isLastBatch && importLogId) {
      const { error: updateLogError } = await supabaseAdmin
        .from('import_logs')
        .update({
          status: 'completed',
          suppliers_created: suppliersCreated,
          rows_processed: rows.length,
          rows_skipped: skipped,
          errors_count: errors.length
        })
        .eq('import_log_id', importLogId);

      if (updateLogError) console.error('Error updating import log:', updateLogError);
    }

    return NextResponse.json({
      success: true,
      suppliersCreated,
      suppliersUpdated,
      skipped,
      errors,
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}