import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows, confirmedMatches = {} } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    let suppliersCreated = 0;
    let brandsCreated = 0;
    let relationshipsCreated = 0;
    let relationshipsVerified = 0;
    let skipped = 0;
    const errors = [];

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

        // 4. Create relationships for each state
        for (const stateId of stateIds) {
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
          }
        }

      } catch (rowError) {
        errors.push(`Error processing ${supplierName} - ${brandName}: ${rowError.message}`);
        skipped++;
      }
    }

    return NextResponse.json({
      suppliersCreated,
      brandsCreated,
      relationshipsCreated,
      relationshipsVerified,
      skipped,
      errors: errors.slice(0, 10) // Limit to first 10 errors
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

