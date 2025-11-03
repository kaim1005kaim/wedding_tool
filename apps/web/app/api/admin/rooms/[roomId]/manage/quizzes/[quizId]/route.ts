import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

const updateQuizSchema = z.object({
  question: z.string().min(1).max(280).optional(),
  choices: z.array(z.string().min(1).max(120)).length(4).optional(),
  answerIndex: z.number().int().min(0).max(3).optional(),
  ord: z.number().int().min(1).optional(),
  imageUrl: z.string().url().optional().or(z.literal(''))
});

// GET individual quiz details
export async function GET(_request: Request, { params }: { params: { roomId: string; quizId: string } }) {
  const authHeader = _request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(token).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('quizzes')
    .select('*')
    .eq('id', params.quizId)
    .eq('room_id', params.roomId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  }

  return NextResponse.json({ quiz: data });
}

// PUT update quiz
export async function PUT(request: Request, { params }: { params: { roomId: string; quizId: string } }) {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(token).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const json = await request.json();
  const updates = updateQuizSchema.parse(json);

  const client = getSupabaseServiceRoleClient();

  // Build update object
  const updateData: any = {};
  if (updates.question !== undefined) updateData.question = updates.question;
  if (updates.choices !== undefined) updateData.choices = updates.choices;
  if (updates.answerIndex !== undefined) updateData.answer_index = updates.answerIndex;
  if (updates.ord !== undefined) updateData.ord = updates.ord;
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl || null;

  const { data, error } = await client
    .from('quizzes')
    .update(updateData)
    .eq('id', params.quizId)
    .eq('room_id', params.roomId)
    .select('id, question, ord')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update quiz' }, { status: 500 });
  }

  return NextResponse.json({ quiz: data });
}

// DELETE quiz
export async function DELETE(_request: Request, { params }: { params: { roomId: string; quizId: string } }) {
  const authHeader = _request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(token).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const client = getSupabaseServiceRoleClient();
  const { error } = await client
    .from('quizzes')
    .delete()
    .eq('id', params.quizId)
    .eq('room_id', params.roomId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
