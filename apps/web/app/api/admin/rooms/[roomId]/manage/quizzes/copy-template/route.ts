import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

const copyTemplateSchema = z.object({
  templateId: z.string().uuid()
});

// POST copy template quiz to room
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
  const { templateId } = copyTemplateSchema.parse(json);

  const client = getSupabaseServiceRoleClient();

  // Get the template
  const { data: template, error: fetchError } = await client
    .from('quizzes')
    .select('*')
    .eq('id', templateId)
    .eq('is_template', true)
    .is('room_id', null)
    .single();

  if (fetchError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Get max ord for this room
  const { data: maxData } = await client
    .from('quizzes')
    .select('ord')
    .eq('room_id', params.roomId)
    .eq('is_template', false)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrd = (maxData?.ord ?? 0) + 1;

  // Create a copy in the room
  const { data, error } = await client
    .from('quizzes')
    .insert({
      room_id: params.roomId,
      question: template.question,
      choices: template.choices,
      answer_index: template.answer_index,
      image_url: template.image_url,
      ord: nextOrd,
      is_template: false
    })
    .select('id, question, ord, is_template')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to copy template' }, { status: 500 });
  }

  return NextResponse.json({ quiz: data });
}
