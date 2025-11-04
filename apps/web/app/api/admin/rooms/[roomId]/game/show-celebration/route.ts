import { NextResponse } from 'next/server';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { showCelebration } from '@/lib/server/room-engine';

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const auth = extractBearerToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(auth).catch(() => null);
  if (!payload || payload.roomId !== roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const result = await showCelebration(roomId);
  return NextResponse.json({ ok: true, ...result });
}
