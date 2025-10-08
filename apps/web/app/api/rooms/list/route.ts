import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id, code, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Room List] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
    }

    return NextResponse.json({ rooms: rooms || [] });
  } catch (err) {
    console.error('[Room List] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
