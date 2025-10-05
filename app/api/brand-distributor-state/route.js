import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
const T = process.env.TABLE_BRAND_DISTRIBUTOR_STATE;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from(T)
    .select('*')
    .order('last_verified_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin.from(T).insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
