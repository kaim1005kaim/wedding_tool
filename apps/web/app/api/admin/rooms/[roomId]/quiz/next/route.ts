import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { showNextQuiz } from '@/lib/server/room-engine';

const bodySchema = z.object({
  representativeByTable: z.boolean().optional().default(true),
  suddenDeath: z.object({
    enabled: z.boolean(),
    by: z.enum(['table', 'player']),
    topK: z.number().int().positive()
  }).nullable().optional()
}).optional();

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = extractBearerToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(auth).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const validated = bodySchema.parse(body);
    const quizId = await showNextQuiz(
      params.roomId,
      undefined,
      validated?.representativeByTable ?? true,
      validated?.suddenDeath ?? null
    );
    return NextResponse.json({ ok: true, quizId });
  } catch (error) {
    console.error('Failed to start next quiz', error);
    const message = error instanceof Error ? error.message : '次のクイズを表示できませんでした';
    const status = message === 'All quizzes have been revealed' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
