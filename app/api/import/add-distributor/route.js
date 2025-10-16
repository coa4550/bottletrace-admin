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
          import_type: 'add_distributor',
          file_name: fileName || 'unknown.csv',
          status: 'in_progress',
          rows_processed: 0
        })
        .select()
        .single();

      if (logError) throw logError;
      importLogId = logData.import_log_id;
    }

    let distributorsCreated = 0;
    let distributorsUpdated = 0;
    let skipped = 0;
    const errors = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const match = confirmedMatches?.[i];
      
      try {
        const distributorName = (row.distributor_name || '').trim();
        
        if (!distributorName) {
          skipped++;
          continue;
        }

        const distributorUrl = (row.distributor_url || '').trim();
        const distributorLogoUrl = (row.distributor_logo_url || '').trim();
        const dataSource = (row.data_source || 'csv_import').trim();

        let distributorId;
        let wasCreated = false;
        let wasUpdated = false;

        // Check if user wants to use existing distributor or create new
        if (match?.useExisting && match?.existingDistributorId) {
          // Use existing distributor - enrich it with new data
          distributorId = match.existingDistributorId;
          
          // Fetch existing distributor to check what fields are empty
          const { data: existingDistributor, error: fetchError } = await supabaseAdmin
            .from('core_distributors')
            .select('distributor_url, distributor_logo_url, data_source')
            .eq('distributor_id', distributorId)
            .single();

          if (fetchError) throw fetchError;

          // Only update fields that are currently null/empty in the database
          const updateData = {};
          if (distributorUrl && !existingDistributor.distributor_url) {
            updateData.distributor_url = distributorUrl;
          }
          if (distributorLogoUrl && !existingDistributor.distributor_logo_url) {
            updateData.distributor_logo_url = distributorLogoUrl;
          }
          // Always update data_source if provided to reflect latest import
          if (dataSource) {
            updateData.data_source = dataSource;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from('core_distributors')
              .update(updateData)
              .eq('distributor_id', distributorId);

            if (updateError) throw updateError;
            wasUpdated = true;
            distributorsUpdated++;

            // Log the enrichment
            await supabaseAdmin
              .from('import_changes')
              .insert({
                import_log_id: importLogId,
                change_type: 'enriched',
                entity_type: 'distributor',
                entity_id: distributorId,
                entity_name: distributorName,
                old_value: existingDistributor,
                new_value: updateData,
                source_row: row
              });
          }

        } else {
          // Create new distributor
          const { data: newDistributor, error: distributorError } = await supabaseAdmin
            .from('core_distributors')
            .insert({
              distributor_name: distributorName,
              distributor_url: distributorUrl || null,
              distributor_logo_url: distributorLogoUrl || null,
              data_source: dataSource
            })
            .select()
            .single();

          if (distributorError) {
            // Check if it's a duplicate error
            if (distributorError.code === '23505') {
              // Distributor already exists, fetch it
              const { data: existingDistributor } = await supabaseAdmin
                .from('core_distributors')
                .select('distributor_id')
                .eq('distributor_name', distributorName)
                .single();
              
              if (existingDistributor) {
                distributorId = existingDistributor.distributor_id;
                skipped++;
              } else {
                throw distributorError;
              }
            } else {
              throw distributorError;
            }
          } else {
            distributorId = newDistributor.distributor_id;
            wasCreated = true;
            distributorsCreated++;

            // Log the creation
            await supabaseAdmin
              .from('import_changes')
              .insert({
                import_log_id: importLogId,
                change_type: 'created',
                entity_type: 'distributor',
                entity_id: distributorId,
                entity_name: distributorName,
                new_value: { 
                  distributor_name: distributorName,
                  distributor_url: distributorUrl,
                  distributor_logo_url: distributorLogoUrl,
                  data_source: dataSource
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
          distributors_created: distributorsCreated,
          rows_processed: rows.length,
          rows_skipped: skipped,
          errors_count: errors.length
        })
        .eq('import_log_id', importLogId);

      if (updateLogError) console.error('Error updating import log:', updateLogError);
    }

    return NextResponse.json({
      success: true,
      distributorsCreated,
      distributorsUpdated,
      skipped,
      errors,
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}