import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

const createCandidateSchema = z.object({
  displayName: z.string().min(1).max(120),
  groupTag: z.enum(['all', 'groom', 'bride'])
});

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(token).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('players')
    .select('id, display_name, group_tag')
    .eq('room_id', params.roomId)
    .not('group_tag', 'is', null)
    .order('display_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ candidates: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(token).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const body = await request.json();
  const { displayName, groupTag } = createCandidateSchema.parse(body);

  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('players')
    .insert({
      room_id: params.roomId,
      display_name: displayName,
      group_tag: groupTag,
      is_present: true
    })
    .select('id, display_name, group_tag')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to add candidate' }, { status: 500 });
  }

  return NextResponse.json({ candidate: data });
}
