import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/submissions/[id]/approve
 * Approve a submission and apply the changes to the database
 */
export async function POST(req, { params }) {
  try {
    const { id } = params;

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('brand_submissions')
      .select('*')
      .eq('brand_submission_id', id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (submission.status === 'approved') {
      return NextResponse.json(
        { error: 'Submission already approved' },
        { status: 400 }
      );
    }

    const { brand_category, submission_type, payload } = submission;

    // Apply the changes based on submission type and category
    let result;
    
    if (submission_type === 'Orphan_Correction') {
      if (brand_category === 'brand_supplier') {
        // Link orphaned brand to suggested supplier
        const { error: insertError } = await supabaseAdmin
          .from('brand_supplier')
          .insert({
            brand_id: payload.orphaned_brand_id,
            supplier_id: payload.suggested_supplier_id,
            relationship_source: 'user_submission',
            is_verified: true,
            last_verified_at: new Date().toISOString()
          });

        if (insertError) {
          // Check if it's a duplicate key error (relationship already exists)
          if (insertError.code === '23505') {
            // Relationship already exists, just update the submission status
            result = { message: 'Relationship already exists, marking as approved' };
          } else {
            throw insertError;
          }
        } else {
          result = { message: 'Brand-supplier relationship created successfully' };
        }
        
        // The trigger will automatically clear the orphan status
        
      } else if (brand_category === 'supplier_distributor') {
        // Link orphaned supplier to suggested distributor in a state
        const { error: insertError } = await supabaseAdmin
          .from('distributor_supplier_state')
          .insert({
            distributor_id: payload.suggested_distributor_id,
            supplier_id: payload.orphaned_supplier_id,
            state_id: payload.suggested_state_id
          });

        if (insertError) {
          // Check if it's a duplicate key error (relationship already exists)
          if (insertError.code === '23505') {
            result = { message: 'Relationship already exists, marking as approved' };
          } else {
            throw insertError;
          }
        } else {
          result = { message: 'Supplier-distributor relationship created successfully' };
        }
        
        // The trigger will automatically clear the orphan status
        
      } else {
        return NextResponse.json(
          { error: 'Unsupported brand_category for orphan correction' },
          { status: 400 }
        );
      }
    } else {
      // Handle other submission types (Addition, Change) if needed
      return NextResponse.json(
        { error: 'Only Orphan_Correction submissions are currently supported for approval' },
        { status: 400 }
      );
    }

    // Update submission status to approved
    const { error: updateError } = await supabaseAdmin
      .from('brand_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString()
      })
      .eq('brand_submission_id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Submission approved successfully'
    });

  } catch (error) {
    console.error('Error approving submission:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

