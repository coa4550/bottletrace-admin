import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pgycxpmqnrjsusgoinxz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBneWN4cG1xbnJqc3VzZ29pbnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTMxNjIsImV4cCI6MjA3MjgyOTE2Mn0.GB-HMHWn7xy5uoXpHhTv8TBO6CNl3a877K5DBIH7ekE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('core_distributors')
      .select('distributor_id, distributor_name, distributor_url, distributor_logo_url')
      .order('distributor_name');

    if (error) {
      console.error('Error fetching distributors:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
