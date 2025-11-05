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
      
      try {
        const distributorName = (row.distributor_name || '').trim();
        const supplierName = (row.supplier_name || '').trim();
        const stateName = (row.state_name || '').trim();
        const stateCode = (row.state_code || '').trim();

        if (!distributorName || !supplierName || (!stateName && !stateCode)) {
          skipped++;
          continue;
        }

        const distributorUrl = (row.distributor_url || '').trim();
        const distributorLogoUrl = (row.distributor_logo_url || '').trim();
        const supplierUrl = (row.supplier_url || '').trim();
        const supplierLogoUrl = (row.supplier_logo_url || '').trim();

        // Store match information in raw_row_data
        const match = confirmedMatches?.[i];
        const rawRowData = {
          ...row,
          confirmedMatch: match || null
        };

        // Write to staging table
        const { error: stagingError } = await supabaseAdmin
          .from('staging_distributor_portfolio')
          .insert({
            distributor_name: distributorName,
            supplier_name: supplierName,
            state_name: stateName || null,
            state_code: stateCode || null,
            distributor_url: distributorUrl || null,
            distributor_logo_url: distributorLogoUrl || null,
            supplier_url: supplierUrl || null,
            supplier_logo_url: supplierLogoUrl || null,
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

    // Update import log
    if (importLogId) {
      if (isLastBatch) {
        await supabaseAdmin
          .from('import_logs')
          .update({ 
            status: errors.length > 0 ? 'partial' : 'completed',
            rows_processed: rowsProcessed,
            rows_skipped: skipped,
            errors_count: errors.length
          })
          .eq('import_log_id', importLogId);
      } else {
        const { data: currentLog } = await supabaseAdmin
          .from('import_logs')
          .select('rows_skipped, errors_count, rows_processed')
          .eq('import_log_id', importLogId)
          .single();
        
        if (currentLog) {
          await supabaseAdmin
            .from('import_logs')
            .update({
              rows_skipped: (currentLog.rows_skipped || 0) + skipped,
              errors_count: (currentLog.errors_count || 0) + errors.length,
              rows_processed: (currentLog.rows_processed || 0) + rowsProcessed
            })
            .eq('import_log_id', importLogId);
        }
      }
    }

    return NextResponse.json({
      rowsProcessed,
      skipped,
      errors: errors.slice(0, 20),
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}