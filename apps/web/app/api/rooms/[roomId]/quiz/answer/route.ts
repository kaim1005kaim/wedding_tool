import { NextResponse } from 'next/server';
import { quizAnswerEventSchema } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyPlayerToken } from '@/lib/auth/jwt';
import { submitQuizAnswer } from '@/lib/server/room-engine';

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = extractBearerToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyPlayerToken(auth).catch(() => null);
  if (!payload || payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Invalid player token' }, { status: 401 });
  }

  const json = await request.json();
  const { quizId, choiceIndex } = quizAnswerEventSchema.parse(json);

  await submitQuizAnswer(payload.roomId, quizId, payload.playerId, choiceIndex);

  return NextResponse.json({ ok: true });
}
