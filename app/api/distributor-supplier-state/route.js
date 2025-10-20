import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('distributor_supplier_state')
    .select(`
      *,
      core_distributors:distributor_id(distributor_name),
      core_suppliers:supplier_id(supplier_name),
      core_states:state_id(state_name)
    `)
    .order('last_verified_at', { ascending: false });
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req) {
  try {
    const { distributor_id, supplier_id, state_id, is_verified } = await req.json();
    
    if (!distributor_id || !supplier_id || !state_id) {
      return NextResponse.json({ 
        error: 'distributor_id, supplier_id, and state_id are required' 
      }, { status: 400 });
    }

    const updateData = {
      is_verified: is_verified !== undefined ? is_verified : true,
      last_verified_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('distributor_supplier_state')
      .update(updateData)
      .eq('distributor_id', distributor_id)
      .eq('supplier_id', supplier_id)
      .eq('state_id', state_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating distributor-supplier-state relationship:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Distributor-supplier-state relationship updated and verified successfully'
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
