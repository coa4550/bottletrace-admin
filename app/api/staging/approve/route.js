import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const STAGING_TABLES = {
  brands: 'staging_brands',
  suppliers: 'staging_suppliers',
  distributors: 'staging_distributors',
  'supplier-portfolio': 'staging_supplier_portfolio',
  'distributor-portfolio': 'staging_distributor_portfolio'
};

export async function POST(req) {
  try {
    const { type, stagingId, isApproved } = await req.json();

    const tableName = STAGING_TABLES[type];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid staging type' }, { status: 400 });
    }

    if (!stagingId) {
      return NextResponse.json({ error: 'stagingId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(tableName)
      .update({ is_approved: isApproved === true })
      .eq('staging_id', stagingId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error updating approval status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
