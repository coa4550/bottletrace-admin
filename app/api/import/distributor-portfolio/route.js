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
          import_type: 'distributor_portfolio',
          file_name: fileName || 'unknown.csv',
          rows_processed: 0,
          status: 'in_progress'
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
    
    // Load all reference data
    const { data: allDistributors } = await supabaseAdmin
      .from('core_distributors')
      .select('distributor_id, distributor_name');
      
    const { data: allSuppliers } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name');
      
    const { data: allStates } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');
    
    // Build lookup maps
    const distributorMap = new Map(allDistributors?.map(d => [d.distributor_name, d]) || []);
    const supplierMap = new Map(allSuppliers?.map(s => [s.supplier_name, s]) || []);
    const stateCodeMap = new Map(allStates?.map(s => [s.state_code?.toUpperCase(), s]) || []);
    
    // Collect entities to create
    const distributorsToCreate = new Map();
    const suppliersToCreate = new Map();
    const relationshipsData = [];
    
    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const distributorName = (row.distributor_name || '').trim();
      const supplierName = (row.supplier_name || '').trim();
      const stateCode = (row.state_code || '').trim().toUpperCase();

      if (!distributorName || !supplierName || !stateCode) {
        skipped++;
        continue;
      }

      try {
        // Track distributors to create
        if (!distributorMap.has(distributorName) && !distributorsToCreate.has(distributorName)) {
          distributorsToCreate.set(distributorName, { distributor_name: distributorName, row });
        }

        // Track suppliers to create
        if (!supplierMap.has(supplierName) && !suppliersToCreate.has(supplierName)) {
          suppliersToCreate.set(supplierName, { supplier_name: supplierName, row });
        }

        // Get state
        const state = stateCodeMap.get(stateCode);
        if (!state) {
          errors.push(`State not found: ${stateCode} (row ${i + 1})`);
          skipped++;
          continue;
        }

        relationshipsData.push({
          distributorName,
          supplierName,
          stateId: state.state_id,
          row
        });
      } catch (rowError) {
        errors.push(`Error processing row ${i + 1}: ${rowError.message}`);
        skipped++;
      }
    }

    // Create distributors
    if (distributorsToCreate.size > 0) {
      const { data: newDistributors, error: distError } = await supabaseAdmin
        .from('core_distributors')
        .insert(Array.from(distributorsToCreate.values()).map(d => ({ distributor_name: d.distributor_name })))
        .select('distributor_id, distributor_name');

      if (distError) throw distError;

      distributorsCreated = newDistributors?.length || 0;
      newDistributors?.forEach(d => {
        distributorMap.set(d.distributor_name, d);
        
        // Log creation
        const sourceRow = distributorsToCreate.get(d.distributor_name)?.row;
        supabaseAdmin.from('import_changes').insert({
          import_log_id: importLogId,
          change_type: 'created',
          entity_type: 'distributor',
          entity_id: d.distributor_id,
          entity_name: d.distributor_name,
          new_value: { distributor_name: d.distributor_name },
          source_row: sourceRow
        });
      });
    }

    // Create suppliers
    if (suppliersToCreate.size > 0) {
      const { data: newSuppliers, error: suppError } = await supabaseAdmin
        .from('core_suppliers')
        .insert(Array.from(suppliersToCreate.values()).map(s => ({ supplier_name: s.supplier_name })))
        .select('supplier_id, supplier_name');

      if (suppError) throw suppError;

      suppliersCreated = newSuppliers?.length || 0;
      newSuppliers?.forEach(s => {
        supplierMap.set(s.supplier_name, s);
        
        // Log creation
        const sourceRow = suppliersToCreate.get(s.supplier_name)?.row;
        supabaseAdmin.from('import_changes').insert({
          import_log_id: importLogId,
          change_type: 'created',
          entity_type: 'supplier',
          entity_id: s.supplier_id,
          entity_name: s.supplier_name,
          new_value: { supplier_name: s.supplier_name },
          source_row: sourceRow
        });
      });
    }

    // Load existing relationships for deduplication
    const distributorIds = [...new Set(relationshipsData.map(r => distributorMap.get(r.distributorName)?.distributor_id).filter(Boolean))];
    
    const existingRelsMap = new Map();
    if (distributorIds.length > 0) {
      const { data: existingRels } = await supabaseAdmin
        .from('distributor_supplier_state')
        .select('distributor_id, supplier_id, state_id')
        .in('distributor_id', distributorIds);

      existingRels?.forEach(rel => {
        const key = `${rel.distributor_id}_${rel.supplier_id}_${rel.state_id}`;
        existingRelsMap.set(key, true);
      });
    }

    // Create relationships
    const relationshipsToInsert = [];
    const now = new Date().toISOString();

    for (const { distributorName, supplierName, stateId, row } of relationshipsData) {
      const distributor = distributorMap.get(distributorName);
      const supplier = supplierMap.get(supplierName);

      if (!distributor || !supplier) {
        errors.push(`Missing distributor or supplier: ${distributorName} - ${supplierName}`);
        skipped++;
        continue;
      }

      const relKey = `${distributor.distributor_id}_${supplier.supplier_id}_${stateId}`;
      
      if (existingRelsMap.has(relKey)) {
        relationshipsVerified++;
      } else {
        relationshipsToInsert.push({
          distributor_id: distributor.distributor_id,
          supplier_id: supplier.supplier_id,
          state_id: stateId,
          created_at: now
        });
      }
    }

    if (relationshipsToInsert.length > 0) {
      const { error: relError } = await supabaseAdmin
        .from('distributor_supplier_state')
        .insert(relationshipsToInsert);

      if (relError && relError.code !== '23505') {
        throw relError;
      }
      relationshipsCreated = relationshipsToInsert.length;
    }

    // Update import log
    if (importLogId && isLastBatch) {
      await supabaseAdmin
        .from('import_logs')
        .update({
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          suppliers_created: suppliersCreated,
          relationships_created: relationshipsCreated,
          relationships_verified: relationshipsVerified,
          rows_skipped: skipped,
          errors_count: errors.length,
          rows_processed: rows.length
        })
        .eq('import_log_id', importLogId);
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
