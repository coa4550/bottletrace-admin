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

    let rowsProcessed = 0;
    let skipped = 0;
    const errors = [];

    // Get current user for imported_by
    const authHeader = req.headers.get('authorization');
    let importedBy = null;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        importedBy = user?.id || null;
      } catch (e) {
        // If auth fails, continue without user
      }
    }

    // Process each row and write to staging
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

        // Store match information in raw_row_data
        const rawRowData = {
          ...row,
          confirmedMatch: match || null
        };

        // Write to staging table
        const { error: stagingError } = await supabaseAdmin
          .from('staging_distributors')
          .insert({
            distributor_name: distributorName,
            distributor_url: distributorUrl || null,
            distributor_logo_url: distributorLogoUrl || null,
            is_approved: false,
            import_log_id: importLogId,
            imported_by: importedBy,
            row_index: i,
            raw_row_data: rawRowData
          });

        if (stagingError) {
          throw stagingError;
        }

        rowsProcessed++;

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
          rows_processed: rowsProcessed,
          rows_skipped: skipped,
          errors_count: errors.length
        })
        .eq('import_log_id', importLogId);

      if (updateLogError) console.error('Error updating import log:', updateLogError);
    }

    return NextResponse.json({
      success: true,
      rowsProcessed,
      skipped,
      errors,
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}