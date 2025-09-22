import { NextResponse } from 'next/server';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { stopGame } from '@/lib/server/room-engine';

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

  await stopGame(roomId);
  return NextResponse.json({ ok: true });
}
