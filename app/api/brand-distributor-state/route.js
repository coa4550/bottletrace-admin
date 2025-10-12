import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const distributorId = searchParams.get('distributor_id');

    if (!distributorId) {
      return NextResponse.json({ error: 'distributor_id parameter is required' }, { status: 400 });
    }

    // Step 1: Get all suppliers for this distributor (via distributor_supplier_state)
    const { data: distSupplierRels, error: distSupplierError } = await supabaseAdmin
      .from('distributor_supplier_state')
      .select('supplier_id')
      .eq('distributor_id', distributorId);

    if (distSupplierError) {
      console.error('Error fetching distributor-supplier relationships:', distSupplierError);
      return NextResponse.json({ error: distSupplierError.message }, { status: 500 });
    }

    const supplierIds = [...new Set(distSupplierRels?.map(r => r.supplier_id) || [])];

    if (supplierIds.length === 0) {
      return NextResponse.json([]);
    }

    // Step 2: Get all brands for those suppliers (via brand_supplier)
    const { data: brandSupplierRels, error: brandSupplierError } = await supabaseAdmin
      .from('brand_supplier')
      .select('brand_id')
      .in('supplier_id', supplierIds);

    if (brandSupplierError) {
      console.error('Error fetching brand-supplier relationships:', brandSupplierError);
      return NextResponse.json({ error: brandSupplierError.message }, { status: 500 });
    }

    const brandIds = [...new Set(brandSupplierRels?.map(r => r.brand_id) || [])];

    if (brandIds.length === 0) {
      return NextResponse.json([]);
    }

    // Step 3: Fetch brand details
    const { data: brands, error: brandsError } = await supabaseAdmin
      .from('core_brands')
      .select('*')
      .in('brand_id', brandIds)
      .order('brand_name');

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return NextResponse.json({ error: brandsError.message }, { status: 500 });
    }

    // Step 4: Fetch categories
    const { data: brandCats, error: catsError } = await supabaseAdmin
      .from('brand_categories')
      .select('brand_id, categories(category_name)')
      .in('brand_id', brandIds);

    if (catsError) {
      console.error('Error fetching categories:', catsError);
      return NextResponse.json({ error: catsError.message }, { status: 500 });
    }

    // Step 5: Fetch subcategories
    const { data: brandSubcats, error: subcatsError } = await supabaseAdmin
      .from('brand_sub_categories')
      .select('brand_id, sub_categories(sub_category_name)')
      .in('brand_id', brandIds);

    if (subcatsError) {
      console.error('Error fetching subcategories:', subcatsError);
      return NextResponse.json({ error: subcatsError.message }, { status: 500 });
    }

    // Step 6: Combine data
    const portfolioBrands = brands?.map(brand => {
      const categories = brandCats
        ?.filter(bc => bc.brand_id === brand.brand_id)
        ?.map(bc => bc.categories?.category_name)
        ?.filter(Boolean) || [];
      
      const subcategories = brandSubcats
        ?.filter(bsc => bsc.brand_id === brand.brand_id)
        ?.map(bsc => bsc.sub_categories?.sub_category_name)
        ?.filter(Boolean) || [];

      return {
        ...brand,
        categories,
        subcategories
      };
    }) || [];

    return NextResponse.json(portfolioBrands);
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}