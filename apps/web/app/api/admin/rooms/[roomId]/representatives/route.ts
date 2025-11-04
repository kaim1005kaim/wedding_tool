import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  const roomId = params.roomId;

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const valid = await verifyAdminToken(token, roomId);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await client
      .from('table_representatives')
      .select('*')
      .eq('room_id', roomId)
      .order('table_no', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ representatives: data ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  const roomId = params.roomId;

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const valid = await verifyAdminToken(token, roomId);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { representatives } = body as { representatives: Array<{ tableNo: string; name: string }> };

    if (!Array.isArray(representatives)) {
      return NextResponse.json({ error: 'representatives must be an array' }, { status: 400 });
    }

    const client = getSupabaseServiceRoleClient();

    // Delete existing representatives
    await client.from('table_representatives').delete().eq('room_id', roomId);

    // Insert new representatives
    if (representatives.length > 0) {
      const { error: insertError } = await client.from('table_representatives').insert(
        representatives.map((rep) => ({
          room_id: roomId,
          table_no: rep.tableNo,
          representative_name: rep.name
        }))
      );

      if (insertError) {
        throw insertError;
      }
    }

    // Refresh snapshot
    const { error: refreshError } = await client.rpc('refresh_room_representatives', {
      p_room_id: roomId
    });

    if (refreshError) {
      throw refreshError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
