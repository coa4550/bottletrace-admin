import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    let suppliersCreated = 0;
    let brandsCreated = 0;
    let relationshipsCreated = 0;
    let skipped = 0;
    const errors = [];

    for (const row of rows) {
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

        // 2. Get or create brand
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

        const brandId = brand.data.brand_id;

        // 3. Get state
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

        const stateId = state.data.state_id;

        // 4. Create relationship (if doesn't exist)
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
              relationship_source: 'csv_import'
            });

          if (relationship.error) throw relationship.error;
          relationshipsCreated++;
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
      skipped,
      errors: errors.slice(0, 10) // Limit to first 10 errors
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

