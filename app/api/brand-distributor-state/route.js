import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pgycxpmqnrjsusgoinxz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBneWN4cG1xbnJqc3VzZ29pbnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTMxNjIsImV4cCI6MjA3MjgyOTE2Mn0.GB-HMHWn7xy5uoXpHhTv8TBO6CNl3a877K5DBIH7ekE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const distributorId = searchParams.get('distributor_id');

    if (!distributorId) {
      return NextResponse.json({ error: 'distributor_id parameter is required' }, { status: 400 });
    }

    // Fetch relationships with pagination
    let allRelationships = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('brand_distributor_state')
        .select('brand_id')
        .eq('distributor_id', distributorId)
        .range(start, start + pageSize - 1);

      if (error) {
        console.error('Error fetching relationships:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allRelationships = [...allRelationships, ...data];
        start += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const brandIds = [...new Set(allRelationships.map(r => r.brand_id))];

    if (brandIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch brand details
    const { data: brands, error: brandsError } = await supabase
      .from('core_brands')
      .select('*')
      .in('brand_id', brandIds)
      .order('brand_name');

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return NextResponse.json({ error: brandsError.message }, { status: 500 });
    }

    // Fetch categories
    const { data: brandCats, error: catsError } = await supabase
      .from('brand_categories')
      .select('brand_id, categories(category_name)')
      .in('brand_id', brandIds);

    if (catsError) {
      console.error('Error fetching categories:', catsError);
      return NextResponse.json({ error: catsError.message }, { status: 500 });
    }

    const { data: brandSubcats, error: subcatsError} = await supabase
      .from('brand_sub_categories')
      .select('brand_id, sub_categories(sub_category_name)')
      .in('brand_id', brandIds);

    if (subcatsError) {
      console.error('Error fetching subcategories:', subcatsError);
      return NextResponse.json({ error: subcatsError.message }, { status: 500 });
    }

    // Combine data
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