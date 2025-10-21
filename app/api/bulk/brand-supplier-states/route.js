import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;
    let errors = [];

    for (const row of rows) {
      try {
        const { brand_id, supplier_id, state_id, is_verified, last_verified_at, relationship_source, created_at } = row;
        
        if (!brand_id || !supplier_id) {
          errors.push({ row, error: 'brand_id and supplier_id are required' });
          continue;
        }

        // Check if relationship already exists
        const { data: existing, error: findError } = await supabaseAdmin
          .from('brand_supplier')
          .select('brand_id, supplier_id, is_verified, last_verified_at')
          .eq('brand_id', brand_id)
          .eq('supplier_id', supplier_id)
          .maybeSingle();

        if (findError) {
          errors.push({ row, error: findError.message });
          continue;
        }

        const updateData = {
          is_verified: is_verified !== undefined ? is_verified : true,
          last_verified_at: last_verified_at || new Date().toISOString(),
          relationship_source: relationship_source || 'bulk_import',
          created_at: created_at || new Date().toISOString()
        };

        if (existing) {
          // Update existing relationship
          const { error: updateError } = await supabaseAdmin
            .from('brand_supplier')
            .update(updateData)
            .eq('brand_id', brand_id)
            .eq('supplier_id', supplier_id);

          if (updateError) {
            errors.push({ row, error: updateError.message });
          } else {
            updated++;
          }
        } else {
          // Insert new relationship
          const { error: insertError } = await supabaseAdmin
            .from('brand_supplier')
            .insert({
              brand_id,
              supplier_id,
              ...updateData
            });

          if (insertError) {
            errors.push({ row, error: insertError.message });
          } else {
            inserted++;
          }
        }
      } catch (rowError) {
        errors.push({ row, error: rowError.message });
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Bulk import completed: ${inserted} inserted, ${updated} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`
    });

  } catch (err) {
    console.error('Bulk import error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
