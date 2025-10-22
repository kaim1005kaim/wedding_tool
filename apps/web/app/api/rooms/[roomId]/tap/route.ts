import { NextResponse } from 'next/server';
import { tapDeltaEventSchema } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyPlayerToken } from '@/lib/auth/jwt';
import { applyTapDelta } from '@/lib/server/room-engine';
import { handleApiError, authError, forbiddenError, rateLimitError } from '@/lib/server/error-handler';

const RATE_WINDOW_MS = 1000;
const MAX_DELTA_PER_WINDOW = 150;
const MIN_INTERVAL_MS = 150;
const RECORD_TTL_MS = 300000; // 5分でレコード削除
const CLEANUP_INTERVAL_MS = 60000; // 1分ごとにクリーンアップ

// メモリリーク対策: TTL付きMap + 定期クリーンアップ
const tapRates = new Map<string, { windowStart: number; total: number; lastTs: number }>();
let cleanupTimer: NodeJS.Timeout | null = null;

// クリーンアップ処理を初期化
function initCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, record] of tapRates.entries()) {
      if (now - record.lastTs > RECORD_TTL_MS) {
        tapRates.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[RateLimit] Cleaned up ${deletedCount} expired records. Current size: ${tapRates.size}`);
    }
  }, CLEANUP_INTERVAL_MS);
}

// サーバー起動時にクリーンアップ開始
initCleanup();

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

    if (!checkRateLimit(payload.playerId)) {
      return rateLimitError('タップが速すぎます。少し待ってからお試しください。', 1);
    }

    await applyTapDelta(payload.roomId, payload.playerId, delta);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'POST /api/rooms/[roomId]/tap');
  }
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
