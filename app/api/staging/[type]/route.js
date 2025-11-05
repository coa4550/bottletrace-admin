import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const STAGING_TABLES = {
  brands: 'staging_brands',
  suppliers: 'staging_suppliers',
  distributors: 'staging_distributors',
  'supplier-portfolio': 'staging_supplier_portfolio',
  'distributor-portfolio': 'staging_distributor_portfolio'
};

export async function GET(req, { params }) {
  try {
    const { type } = params;
    const { searchParams } = new URL(req.url);
    
    const tableName = STAGING_TABLES[type];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid staging type' }, { status: 400 });
    }

    const importLogId = searchParams.get('import_log_id');
    const filter = searchParams.get('filter'); // 'all', 'approved', 'pending', 'rejected'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from(tableName)
      .select('*', { count: 'exact' })
      .order('imported_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by import log if provided
    if (importLogId) {
      query = query.eq('import_log_id', importLogId);
    }

    // Filter by approval status
    if (filter === 'approved') {
      query = query.eq('is_approved', true);
    } else if (filter === 'pending') {
      query = query.eq('is_approved', false);
    } else if (filter === 'rejected') {
      // For rejected, we'll need to check if there's a rejected field or use is_approved=false
      // For now, we'll treat rejected as not approved (can be enhanced later)
      query = query.eq('is_approved', false);
    }
    // 'all' doesn't add a filter

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching staging data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
