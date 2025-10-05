import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
const T = process.env.TABLE_STATES;

export async function GET() {
  const { data, error } = await supabaseAdmin.from(T).select('*').order('state_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
