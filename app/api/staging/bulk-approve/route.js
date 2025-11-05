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
    const { type, stagingIds, isApproved, importLogId } = await req.json();

    const tableName = STAGING_TABLES[type];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid staging type' }, { status: 400 });
    }

    if (!Array.isArray(stagingIds) || stagingIds.length === 0) {
      return NextResponse.json({ error: 'stagingIds array is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from(tableName)
      .update({ is_approved: isApproved === true })
      .in('staging_id', stagingIds);

    // Optionally filter by import log
    if (importLogId) {
      query = query.eq('import_log_id', importLogId);
    }

    const { data, error } = await query.select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      updated: data?.length || 0,
      data: data || []
    });

  } catch (error) {
    console.error('Error bulk updating approval status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
