import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
  }

  try {
    const client = getSupabaseServiceRoleClient();

    const { data, error } = await client
      .from('rooms')
      .select('id')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ roomId: data.id });
  } catch (error) {
    console.error('Room lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}