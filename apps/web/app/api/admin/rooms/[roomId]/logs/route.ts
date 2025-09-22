import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { fetchAuditLogs, fetchLotteryHistory } from '@/lib/server/audit';

const paramsSchema = z.object({
  roomId: z.string().uuid()
});

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const { roomId } = paramsSchema.parse(params);

  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await verifyAdminToken(token);
    if (payload.roomId !== roomId) {
      return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const [logs, lotteries] = await Promise.all([fetchAuditLogs(roomId), fetchLotteryHistory(roomId)]);

  return NextResponse.json({ logs, lotteries });
}
