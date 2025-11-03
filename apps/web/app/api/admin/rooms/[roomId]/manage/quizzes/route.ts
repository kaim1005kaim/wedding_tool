import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

const createQuizSchema = z.object({
  question: z.string().min(1).max(280),
  choices: z.array(z.string().min(1).max(120)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  ord: z.number().int().min(1).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isTemplate: z.boolean().optional().default(false)
});

export async function GET(_request: Request, { params }: { params: { roomId: string } }) {
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

  // Get both room-specific quizzes and templates
  const { data: roomQuizzes, error: roomError } = await client
    .from('quizzes')
    .select('id, question, ord, is_template')
    .eq('room_id', params.roomId)
    .eq('is_template', false)
    .order('ord', { ascending: true });

  const { data: templates, error: templateError } = await client
    .from('quizzes')
    .select('id, question, ord, is_template')
    .is('room_id', null)
    .eq('is_template', true)
    .order('ord', { ascending: true });

  if (roomError || templateError) {
    return NextResponse.json({ error: roomError?.message || templateError?.message }, { status: 500 });
  }

  return NextResponse.json({
    quizzes: roomQuizzes ?? [],
    templates: templates ?? []
  });
}

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
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
  const { question, choices, answerIndex, ord, imageUrl, isTemplate } = createQuizSchema.parse(json);

  const client = getSupabaseServiceRoleClient();
  let finalOrd = ord;
  if (!finalOrd) {
    // For templates, get max ord from templates; for room quizzes, get max from room
    const query = client
      .from('quizzes')
      .select('ord')
      .order('ord', { ascending: false })
      .limit(1);

    if (isTemplate) {
      query.is('room_id', null).eq('is_template', true);
    } else {
      query.eq('room_id', params.roomId).eq('is_template', false);
    }

    const { data: maxData } = await query.maybeSingle();
    finalOrd = (maxData?.ord ?? 0) + 1;
  }

  const { data, error } = await client
    .from('quizzes')
    .insert({
      room_id: isTemplate ? null : params.roomId,
      question,
      choices,
      answer_index: answerIndex,
      ord: finalOrd,
      image_url: imageUrl || null,
      is_template: isTemplate
    })
    .select('id, question, ord, is_template')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create quiz' }, { status: 500 });
  }

  return NextResponse.json({ quiz: data });
}
