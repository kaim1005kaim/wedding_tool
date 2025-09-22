import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { startGame } from '@/lib/server/room-engine';

const bodySchema = z
  .object({
    countdownMs: z.number().int().nonnegative().optional()
  })
  .optional();

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  const auth = extractBearerToken(request.headers.get('authorization'));

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(auth).catch(() => null);
  if (!payload || payload.roomId !== roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const body = bodySchema.parse(await request.json().catch(() => ({})));
  await startGame(roomId, body?.countdownMs);

  return NextResponse.json({ ok: true });
}
