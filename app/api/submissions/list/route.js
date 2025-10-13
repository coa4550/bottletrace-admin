import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/submissions/list
 * Fetch all submissions using admin privileges (bypasses RLS)
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Unexpected error in GET /api/submissions/list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

