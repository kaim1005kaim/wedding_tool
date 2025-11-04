import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { resetQuizProgress } from '@/lib/server/room-engine';

export async function POST(req: NextRequest, props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  const roomId = params.roomId;

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const valid = await verifyAdminToken(token, roomId);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    await resetQuizProgress(roomId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
