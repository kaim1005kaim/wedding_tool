import { NextResponse } from 'next/server';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyPlayerToken } from '@/lib/auth/jwt';
import { authError, forbiddenError } from '@/lib/server/error-handler';

export async function GET(request: Request, props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  const roomId = params.roomId;

  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return authError();
  }

  let payload;
  try {
    payload = await verifyPlayerToken(token);
  } catch (error) {
    return authError('トークンが無効です。');
  }

  if (payload.roomId !== roomId) {
    return forbiddenError();
  }

  return NextResponse.json({ ok: true, playerId: payload.playerId });
}
