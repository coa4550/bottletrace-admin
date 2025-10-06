import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Expected payload:
 * {
 *   type: 'brand',
 *   rows: [
 *     {
 *       brand_name, brand_url, brand_logo_url,
 *       brand_supplier, brand_distributor,
 *       brand_categories, brand_sub_categories,
 *       data_source
 *     }, ...
 *   ]
 * }
 */

export async function POST(req) {
  try {
    const { type, rows } = await req.json();
    if (type !== 'brand') {
      return NextResponse.json({ error: 'Unsupported import type' }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    let inserted = 0;
    let updated = 0;
    let linked = 0;
    let skipped = 0;

    // Helpers
    const getOrCreate = async (table, uniqueKey, value, returningCols='*') => {
      const { data: found, error: findErr } = await supabaseAdmin
        .from(table)
        .select(returningCols)
        .eq(uniqueKey, value)
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;
      if (found) return found;

      const insertObj = { [uniqueKey]: value };
      const { data: created, error: insErr } = await supabaseAdmin
        .from(table)
        .insert(insertObj)
        .select(returningCols)
        .single();
      if (insErr) throw insErr;
      return created;
    };

    const linkIfMissing = async (table, linkObj, uniqueCols) => {
      // Check existence
      let q = supabaseAdmin.from(table).select('1', { count: 'exact', head: true });
      uniqueCols.forEach(k => q = q.eq(k, linkObj[k]));
      const { error: checkErr, count } = await q;
      if (checkErr) throw checkErr;
      if (count && count > 0) return false;

      const { error: insErr } = await supabaseAdmin.from(table).insert(linkObj);
      if (insErr) throw insErr;
      return true;
    };

    for (const r of rows) {
      const name = (r.brand_name || '').trim();
      if (!name) { skipped++; continue; }

      // Upsert brand
      const { data: existing, error: findErr } = await supabaseAdmin
        .from('core_brands')
        .select('brand_id, brand_name, brand_url, brand_logo_url, data_source')
        .eq('brand_name', name)
        .maybeSingle();
      if (findErr) throw findErr;

      const brandPayload = {
        brand_name: name,
        brand_url: (r.brand_url || null) || null,
        brand_logo_url: (r.brand_logo_url || null) || null,
        data_source: (r.data_source || 'csv_import')
      };

      let brandId;
      if (!existing) {
        const { data: ins, error: insErr } = await supabaseAdmin
          .from('core_brands')
          .insert(brandPayload)
          .select('brand_id')
          .single();
        if (insErr) throw insErr;
        inserted++;
        brandId = ins.brand_id;
      } else {
        const { data: upd, error: updErr } = await supabaseAdmin
          .from('core_brands')
          .update(brandPayload)
          .eq('brand_id', existing.brand_id)
          .select('brand_id')
          .single();
        if (updErr) throw updErr;
        updated++;
        brandId = upd.brand_id;
      }

      // Categories
      const categories = (r.brand_categories || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      for (const cat of categories) {
        const c = await getOrCreate('categories', 'category_name', cat, 'category_id, category_name');
        const linkedNow = await linkIfMissing('brand_categories',
          { brand_id: brandId, category_id: c.category_id },
          ['brand_id', 'category_id']
        );
        if (linkedNow) linked++;
      }

      // Sub-categories
      const subcats = (r.brand_sub_categories || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      for (const sub of subcats) {
        const sc = await getOrCreate('sub_categories', 'sub_category_name', sub, 'sub_category_id, sub_category_name');
        const linkedNow = await linkIfMissing('brand_sub_categories',
          { brand_id: brandId, sub_category_id: sc.sub_category_id },
          ['brand_id', 'sub_category_id']
        );
        if (linkedNow) linked++;
      }

      // NOTE: brand_supplier + brand_distributor parsing hooks exist here.
      // We'll implement supplier/distributor/state mapping in the next route iteration.
      // Keep the incoming fields so we can extend without changing the CSV.
    }

    return NextResponse.json({ ok: true, inserted, updated, linked, skipped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}