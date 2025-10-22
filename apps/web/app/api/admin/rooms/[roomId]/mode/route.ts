import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { switchRoomMode } from '@/lib/server/room-engine';
import { handleApiError, authError, forbiddenError } from '@/lib/server/error-handler';

const requestSchema = z.object({
  to: z.enum(['countup', 'quiz', 'lottery', 'idle'])
});

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return authError();
    }

    let payload;
    try {
      payload = await verifyAdminToken(token);
    } catch (error) {
      return authError('管理者トークンが無効です。再度ログインしてください。');
    }

    if (payload.roomId !== params.roomId) {
      return forbiddenError();
    }

    const json = await request.json();
    const { to } = requestSchema.parse(json);

    await switchRoomMode(params.roomId, to);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'POST /api/admin/rooms/[roomId]/mode');
  }
}
