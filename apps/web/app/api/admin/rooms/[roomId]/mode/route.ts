import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { switchRoomMode } from '@/lib/server/room-engine';

const requestSchema = z.object({
  to: z.enum(['countup', 'quiz', 'lottery', 'idle'])
});

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await verifyAdminToken(token);
    if (payload.roomId !== params.roomId) {
      return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const json = await request.json();
  const { to } = requestSchema.parse(json);
  const roomId = params.roomId;

  await switchRoomMode(roomId, to);

  return NextResponse.json({ ok: true });
}
