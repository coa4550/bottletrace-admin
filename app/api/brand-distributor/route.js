import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // Get all brand-supplier relationships
    const { data: brandSupplierData, error: brandSupplierError } = await supabaseAdmin
      .from('brand_supplier')
      .select(`
        brand_id,
        supplier_id,
        is_verified,
        last_verified_at,
        relationship_source,
        created_at,
        core_brands(brand_name),
        core_suppliers(supplier_name)
      `)
      .order('created_at', { ascending: false });

    if (brandSupplierError) {
      console.error('Error fetching brand-supplier relationships:', brandSupplierError);
      return NextResponse.json({ error: brandSupplierError.message }, { status: 500 });
    }

    // Get all distributor-supplier-state relationships
    const { data: distSupplierData, error: distSupplierError } = await supabaseAdmin
      .from('distributor_supplier_state')
      .select(`
        distributor_id,
        supplier_id,
        state_id,
        core_distributors(distributor_name),
        core_suppliers(supplier_name),
        core_states(state_name, state_code)
      `);

    if (distSupplierError) {
      console.error('Error fetching distributor-supplier relationships:', distSupplierError);
      return NextResponse.json({ error: distSupplierError.message }, { status: 500 });
    }

    // Build brand -> distributor relationships via suppliers
    const relationships = [];
    
    for (const brandSupplier of brandSupplierData || []) {
      // Find all distributors that carry this supplier
      const distributors = distSupplierData?.filter(
        ds => ds.supplier_id === brandSupplier.supplier_id
      ) || [];

      for (const dist of distributors) {
        relationships.push({
          brand_id: brandSupplier.brand_id,
          brand_name: brandSupplier.core_brands?.brand_name,
          supplier_id: brandSupplier.supplier_id,
          supplier_name: brandSupplier.core_suppliers?.supplier_name,
          distributor_id: dist.distributor_id,
          distributor_name: dist.core_distributors?.distributor_name,
          state_id: dist.state_id,
          state_name: dist.core_states?.state_name,
          state_code: dist.core_states?.state_code,
          is_verified: brandSupplier.is_verified,
          last_verified_at: brandSupplier.last_verified_at,
          relationship_source: brandSupplier.relationship_source,
          created_at: brandSupplier.created_at
        });
      }
    }

    return NextResponse.json(relationships);
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

