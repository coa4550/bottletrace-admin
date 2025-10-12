import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/submissions
 * Create a new submission (addition, change, or orphan correction)
 * 
 * Expected payload structure depends on submission type:
 * 
 * Orphan Correction (brand_supplier):
 * {
 *   submission_type: 'Orphan_Correction',
 *   brand_category: 'brand_supplier',
 *   payload: {
 *     orphaned_brand_id: uuid,
 *     orphaned_brand_name: string,
 *     suggested_supplier_id: uuid,
 *     suggested_supplier_name: string,
 *     reason: string (optional)
 *   },
 *   user_email: string (optional),
 *   user_first_name: string (optional),
 *   user_last_name: string (optional),
 *   additional_notes: string (optional)
 * }
 * 
 * Orphan Correction (supplier_distributor):
 * {
 *   submission_type: 'Orphan_Correction',
 *   brand_category: 'supplier_distributor',
 *   payload: {
 *     orphaned_supplier_id: uuid,
 *     orphaned_supplier_name: string,
 *     suggested_distributor_id: uuid,
 *     suggested_distributor_name: string,
 *     suggested_state_id: uuid,
 *     suggested_state_name: string,
 *     reason: string (optional)
 *   },
 *   user_email: string (optional),
 *   user_first_name: string (optional),
 *   user_last_name: string (optional),
 *   additional_notes: string (optional)
 * }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    
    const {
      submission_type = 'Addition',
      brand_category,
      payload,
      user_email,
      user_first_name,
      user_last_name,
      additional_notes
    } = body;

    // Validate required fields
    if (!brand_category) {
      return NextResponse.json(
        { error: 'brand_category is required' },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(
        { error: 'payload is required and must be an object' },
        { status: 400 }
      );
    }

    // Extract names from payload for easier querying
    let brand_name_submitted = null;
    let supplier_name_submitted = null;
    let distributor_name_submitted = null;

    if (brand_category === 'brand_supplier') {
      brand_name_submitted = payload.orphaned_brand_name || payload.brand_name;
      supplier_name_submitted = payload.suggested_supplier_name || payload.supplier_name;
    } else if (brand_category === 'supplier_distributor') {
      supplier_name_submitted = payload.orphaned_supplier_name || payload.supplier_name;
      distributor_name_submitted = payload.suggested_distributor_name || payload.distributor_name;
    } else if (brand_category === 'brand') {
      brand_name_submitted = payload.brand_name;
    } else if (brand_category === 'supplier') {
      supplier_name_submitted = payload.supplier_name;
    } else if (brand_category === 'distributor') {
      distributor_name_submitted = payload.distributor_name;
    }

    // Insert into brand_submissions table
    const { data, error } = await supabaseAdmin
      .from('brand_submissions')
      .insert({
        brand_category,
        submission_type,
        payload,
        status: 'pending',
        brand_name_submitted,
        supplier_name_submitted,
        distributor_name_submitted,
        user_email,
        user_first_name,
        user_last_name,
        additional_notes,
        submitted_at: new Date().toISOString()
      })
      .select('brand_submission_id')
      .single();

    if (error) {
      console.error('Error creating submission:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submission_id: data.brand_submission_id,
      message: 'Submission created successfully'
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/submissions
 * List all submissions with optional filtering
 * Query params:
 * - status: filter by status (pending, approved, rejected, etc.)
 * - submission_type: filter by type (Addition, Change, Orphan_Correction)
 * - brand_category: filter by category
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const submission_type = searchParams.get('submission_type');
    const brand_category = searchParams.get('brand_category');

    let query = supabaseAdmin
      .from('brand_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (submission_type) {
      query = query.eq('submission_type', submission_type);
    }

    if (brand_category) {
      query = query.eq('brand_category', brand_category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Unexpected error in GET /api/submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

