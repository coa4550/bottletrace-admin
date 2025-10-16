import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { distributor_name, distributor_url, distributor_logo_url } = await req.json();
    
    if (!distributor_name || !distributor_name.trim()) {
      return NextResponse.json({ error: 'Distributor name is required' }, { status: 400 });
    }

    const trimmedName = distributor_name.trim();
    const trimmedUrl = distributor_url?.trim() || null;
    const trimmedLogoUrl = distributor_logo_url?.trim() || null;

    // Check if distributor already exists
    const { data: existingDistributor, error: checkError } = await supabaseAdmin
      .from('core_distributors')
      .select('distributor_id, distributor_name')
      .eq('distributor_name', trimmedName)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw checkError;
    }

    if (existingDistributor) {
      return NextResponse.json({ 
        error: `Distributor "${existingDistributor.distributor_name}" already exists (ID: ${existingDistributor.distributor_id})` 
      }, { status: 409 });
    }

    // Create new distributor
    const { data: newDistributor, error: insertError } = await supabaseAdmin
      .from('core_distributors')
      .insert({
        distributor_name: trimmedName,
        distributor_url: trimmedUrl,
        distributor_logo_url: trimmedLogoUrl,
        data_source: 'manual_entry'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log the creation
    await supabaseAdmin
      .from('import_logs')
      .insert({
        import_type: 'add_distributor',
        file_name: 'manual_entry',
        status: 'completed',
        rows_processed: 1,
        rows_skipped: 0,
        errors_count: 0
      });

    return NextResponse.json({
      success: true,
      distributor_id: newDistributor.distributor_id,
      distributor_name: newDistributor.distributor_name,
      distributor_url: newDistributor.distributor_url,
      distributor_logo_url: newDistributor.distributor_logo_url
    });

  } catch (error) {
    console.error('Add distributor error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
