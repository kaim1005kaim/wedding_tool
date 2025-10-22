import { NextResponse } from 'next/server';
import { tapDeltaEventSchema } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyPlayerToken } from '@/lib/auth/jwt';
import { applyTapDelta } from '@/lib/server/room-engine';
import { handleApiError, authError, forbiddenError } from '@/lib/server/error-handler';

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return authError();
    }

    let payload;
    try {
      payload = await verifyPlayerToken(token);
    } catch (error) {
      return authError('トークンが無効です。再度ログインしてください。');
    }

    if (payload.roomId !== params.roomId) {
      return forbiddenError();
    }

    const json = await request.json();
    const { delta } = tapDeltaEventSchema.parse(json);

    await applyTapDelta(payload.roomId, payload.playerId, delta);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'POST /api/rooms/[roomId]/tap');
  }
}
