import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/submissions/[id]/reject
 * Reject a submission with an optional reason
 */
export async function POST(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { rejection_reason } = body;

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('user_submissions')
      .select('*')
      .eq('submission_id', id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (submission.status === 'rejected') {
      return NextResponse.json(
        { error: 'Submission already rejected' },
        { status: 400 }
      );
    }

    // Update submission status to rejected
    // Create a system admin user ID for admin actions (using a fixed UUID for system admin)
    const systemAdminId = '00000000-0000-0000-0000-000000000001';
    const { error: updateError } = await supabaseAdmin
      .from('user_submissions')
      .update({
        status: 'rejected',
        rejection_reason: rejection_reason || 'No reason provided',
        reviewed_at: new Date().toISOString(),
        reviewed_by: systemAdminId
      })
      .eq('submission_id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Submission rejected successfully'
    });

  } catch (error) {
    console.error('Error rejecting submission:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

