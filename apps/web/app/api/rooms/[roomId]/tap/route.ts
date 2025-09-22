import { NextResponse } from 'next/server';
import { tapDeltaEventSchema } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyPlayerToken } from '@/lib/auth/jwt';
import { applyTapDelta } from '@/lib/server/room-engine';

const RATE_WINDOW_MS = 1000;
const MAX_DELTA_PER_WINDOW = 150;
const MIN_INTERVAL_MS = 150;
const tapRates = new Map<string, { windowStart: number; total: number; lastTs: number }>();

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyPlayerToken(token);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.roomId !== params.roomId) {
    return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
  }

  const json = await request.json();
  const { delta } = tapDeltaEventSchema.parse(json);

  if (!checkRateLimit(payload.playerId)) {
    return NextResponse.json({ error: 'Too many taps' }, { status: 429 });
  }

  await applyTapDelta(payload.roomId, payload.playerId, delta);

  return NextResponse.json({ ok: true });
}

function checkRateLimit(playerId: string) {
  const now = Date.now();
  const record = tapRates.get(playerId) ?? { windowStart: now, total: 0, lastTs: 0 };

  if (now - record.lastTs < MIN_INTERVAL_MS) {
    tapRates.set(playerId, { ...record, lastTs: now });
    return false;
  }

  if (now - record.windowStart > RATE_WINDOW_MS) {
    record.windowStart = now;
    record.total = 0;
  }

  record.total += 1;
  record.lastTs = now;
  tapRates.set(playerId, record);

  return record.total <= MAX_DELTA_PER_WINDOW;
}
