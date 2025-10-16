import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { supplier_name, supplier_url, supplier_logo_url } = await req.json();
    
    if (!supplier_name || !supplier_name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const trimmedName = supplier_name.trim();
    const trimmedUrl = supplier_url?.trim() || null;
    const trimmedLogoUrl = supplier_logo_url?.trim() || null;

    // Check if supplier already exists
    const { data: existingSupplier, error: checkError } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name')
      .eq('supplier_name', trimmedName)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw checkError;
    }

    if (existingSupplier) {
      return NextResponse.json({ 
        error: `Supplier "${existingSupplier.supplier_name}" already exists (ID: ${existingSupplier.supplier_id})` 
      }, { status: 409 });
    }

    // Create new supplier
    const { data: newSupplier, error: insertError } = await supabaseAdmin
      .from('core_suppliers')
      .insert({
        supplier_name: trimmedName,
        supplier_url: trimmedUrl,
        supplier_logo_url: trimmedLogoUrl,
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
        import_type: 'add_supplier',
        file_name: 'manual_entry',
        status: 'completed',
        rows_processed: 1,
        rows_skipped: 0,
        errors_count: 0
      });

    return NextResponse.json({
      success: true,
      supplier_id: newSupplier.supplier_id,
      supplier_name: newSupplier.supplier_name,
      supplier_url: newSupplier.supplier_url,
      supplier_logo_url: newSupplier.supplier_logo_url
    });

  } catch (error) {
    console.error('Add supplier error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
