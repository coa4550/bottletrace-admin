import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/reviews/[id]/deny
 * Deny a pending review
 * 
 * Expected body:
 * {
 *   review_type: 'brand' | 'supplier' | 'distributor',
 *   review_notes: string (required - reason for denial)
 * }
 */
export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { review_type, review_notes, reviewed_by } = await req.json();

    if (!review_type || !['brand', 'supplier', 'distributor'].includes(review_type)) {
      return NextResponse.json(
        { error: 'Valid review_type is required (brand, supplier, or distributor)' },
        { status: 400 }
      );
    }

    if (!review_notes) {
      return NextResponse.json(
        { error: 'review_notes is required for denying a review' },
        { status: 400 }
      );
    }

    // Determine the table and ID column based on review type
    let tableName;
    let idColumn;
    
    switch (review_type) {
      case 'brand':
        tableName = 'brand_reviews';
        idColumn = 'brand_review_id';
        break;
      case 'supplier':
        tableName = 'supplier_reviews';
        idColumn = 'supplier_review_id';
        break;
      case 'distributor':
        tableName = 'distributor_reviews';
        idColumn = 'distributor_review_id';
        break;
    }

    // Update the review status to denied
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .update({
        status: 'denied',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewed_by || null,
        review_notes: review_notes
      })
      .eq(idColumn, id)
      .select()
      .single();

    if (error) {
      console.error('Error denying review:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Review denied successfully',
      review: data
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/reviews/[id]/deny:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

