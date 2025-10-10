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
    let brandsCreated = 0;
    let relationshipsCreated = 0;
    let relationshipsVerified = 0;
    let skipped = 0;
    const errors = [];
    const changes = [];
    
    // Pre-load all distributors, brands, and states
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
    
    const { data: allStates, error: statesError } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');
    
    if (statesError) throw statesError;
    
    // Build lookup maps
    const distributorMap = new Map(allDistributors?.map(d => [d.distributor_name, d]) || []);
    const brandMap = new Map(allBrands?.map(b => [b.brand_name, b]) || []);
    const brandIdMap = new Map(allBrands?.map(b => [b.brand_id, b]) || []);
    const stateCodeMap = new Map(allStates?.map(s => [s.state_code?.toLowerCase(), s]) || []);
    const stateNameMap = new Map(allStates?.map(s => [s.state_name?.toLowerCase(), s]) || []);
    
    console.log(`Loaded ${allBrands?.length || 0} brands, ${allDistributors?.length || 0} distributors, ${allStates?.length || 0} states`);
    
    const distributorsToCreate = [];
    const brandsToCreate = [];
    const rowData = [];
    
    // Step 1: Process rows
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const distributorName = (row.distributor_name || '').trim();
      const brandName = (row.brand_name || '').trim();
      const stateName = (row.state_name || '').trim();
      const stateCode = (row.state_code || '').trim();

      if (!distributorName || !brandName || (!stateName && !stateCode)) {
        skipped++;
        continue;
      }

      try {
        if (!distributorMap.has(distributorName) && !distributorsToCreate.some(d => d.name === distributorName)) {
          distributorsToCreate.push({ name: distributorName, row });
        }

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
            errors.push(`State not found: ${stateName || stateCode} (row: ${distributorName} - ${brandName})`);
            skipped++;
            continue;
          }
          stateIds = [state.state_id];
        }

        rowData.push({ rowIndex, row, distributorName, brandName: targetBrandName, stateIds });
      } catch (rowError) {
        errors.push(`Error processing ${distributorName} - ${brandName}: ${rowError.message}`);
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

    // Step 4: Load existing relationships for all distributors
    const allDistributorIds = [...new Set(rowData.map(r => distributorMap.get(r.distributorName)?.distributor_id).filter(Boolean))];
    const existingRelsMap = new Map();
    
    if (allDistributorIds.length > 0) {
      let allExistingRels = [];
      start = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('brand_distributor_state')
          .select('brand_id, distributor_id, state_id')
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
        existingRelsMap.set(`${rel.distributor_id}_${rel.brand_id}_${rel.state_id}`, true);
      });
    }

    // Step 5: Prepare relationships to upsert
    const now = new Date().toISOString();
    const relationshipsToCreate = [];
    const relationshipsToUpdate = [];

    for (const { row, distributorName, brandName, stateIds } of rowData) {
      const distributor = distributorMap.get(distributorName);
      const brand = brandMap.get(brandName);

      if (!distributor) {
        errors.push(`Could not find distributor: ${distributorName}`);
        skipped++;
        continue;
      }
      
      if (!brand) {
        errors.push(`Could not find brand: ${brandName}`);
        skipped++;
        continue;
      }

      for (const stateId of stateIds) {
        const relKey = `${distributor.distributor_id}_${brand.brand_id}_${stateId}`;
        
        if (existingRelsMap.has(relKey)) {
          relationshipsToUpdate.push({
            brand_id: brand.brand_id,
            distributor_id: distributor.distributor_id,
            state_id: stateId
          });
        } else {
          relationshipsToCreate.push({
            brand_id: brand.brand_id,
            distributor_id: distributor.distributor_id,
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
        .from('brand_distributor_state')
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
          .from('brand_distributor_state')
          .update({
            is_verified: true,
            last_verified_at: now,
            relationship_source: 'csv_import'
          })
          .eq('brand_id', rel.brand_id)
          .eq('distributor_id', rel.distributor_id)
          .eq('state_id', rel.state_id);

        if (updateError) throw updateError;
        relationshipsVerified++;
      }
    }

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
        .select('suppliers_created, brands_created, relationships_created, relationships_verified, rows_skipped, errors_count, rows_processed')
        .eq('import_log_id', importLogId)
        .single();
      
      if (currentLog) {
        await supabaseAdmin
          .from('import_logs')
          .update({
            suppliers_created: (currentLog.suppliers_created || 0) + distributorsCreated,
            brands_created: (currentLog.brands_created || 0) + brandsCreated,
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
      brandsCreated,
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

