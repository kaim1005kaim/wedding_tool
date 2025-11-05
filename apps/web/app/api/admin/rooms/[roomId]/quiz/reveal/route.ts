import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { revealQuiz } from '@/lib/server/room-engine';

const bodySchema = z.object({
  quizId: z.string().uuid(),
  points: z.number().int().min(0).optional()
});

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const auth = extractBearerToken(request.headers.get('authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAdminToken(auth).catch(() => null);
    if (!payload || payload.roomId !== params.roomId) {
      return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    await revealQuiz(params.roomId, body.quizId, body.points);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Quiz Reveal Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reveal quiz' },
      { status: 500 }
    );
  }
}
