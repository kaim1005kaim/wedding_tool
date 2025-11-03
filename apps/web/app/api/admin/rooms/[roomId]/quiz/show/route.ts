import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { showQuiz } from '@/lib/server/room-engine';

const bodySchema = z.object({
  quizId: z.string().uuid(),
  deadlineTs: z.number().int().optional(),
  representativeByTable: z.boolean().optional().default(true),
  suddenDeath: z.object({
    enabled: z.boolean(),
    by: z.enum(['table', 'player']),
    topK: z.number().int().positive()
  }).nullable().optional()
});

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = extractBearerToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(auth).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const body = bodySchema.parse(await request.json());
  const deadlineTs = body.deadlineTs ?? Date.now() + 30_000;
  await showQuiz(
    params.roomId,
    body.quizId,
    deadlineTs,
    body.representativeByTable ?? true,
    body.suddenDeath ?? null
  );

  return NextResponse.json({ ok: true });
}
