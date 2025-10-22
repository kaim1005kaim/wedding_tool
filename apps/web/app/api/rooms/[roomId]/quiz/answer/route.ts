import { NextResponse } from 'next/server';
import { quizAnswerEventSchema } from '@wedding_tool/schema';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyPlayerToken } from '@/lib/auth/jwt';
import { submitQuizAnswer } from '@/lib/server/room-engine';
import { handleApiError, authError, forbiddenError, rateLimitError } from '@/lib/server/error-handler';

// クイズ回答のレート制限（同一プレイヤーが短時間に複数回答するのを防ぐ）
const QUIZ_RATE_WINDOW_MS = 2000; // 2秒
const QUIZ_RECORD_TTL_MS = 300000; // 5分
const QUIZ_CLEANUP_INTERVAL_MS = 60000; // 1分

const quizAnswerRates = new Map<string, { lastTs: number; quizId: string }>();
let quizCleanupTimer: NodeJS.Timeout | null = null;

function initQuizCleanup() {
  if (quizCleanupTimer) return;

  quizCleanupTimer = setInterval(() => {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, record] of quizAnswerRates.entries()) {
      if (now - record.lastTs > QUIZ_RECORD_TTL_MS) {
        quizAnswerRates.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[QuizRateLimit] Cleaned up ${deletedCount} expired records. Current size: ${quizAnswerRates.size}`);
    }
  }, QUIZ_CLEANUP_INTERVAL_MS);
}

initQuizCleanup();

function checkQuizRateLimit(playerId: string, quizId: string): boolean {
  const now = Date.now();
  const key = `${playerId}:${quizId}`;
  const record = quizAnswerRates.get(key);

  if (record && now - record.lastTs < QUIZ_RATE_WINDOW_MS) {
    return false;
  }

  quizAnswerRates.set(key, { lastTs: now, quizId });
  return true;
}

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const auth = extractBearerToken(request.headers.get('authorization'));
    if (!auth) {
      return authError();
    }

    const payload = await verifyPlayerToken(auth).catch(() => null);
    if (!payload || payload.roomId !== params.roomId) {
      return authError('トークンが無効です。');
    }

    const json = await request.json();
    const { quizId, choiceIndex } = quizAnswerEventSchema.parse(json);

    // レート制限チェック
    if (!checkQuizRateLimit(payload.playerId, quizId)) {
      return rateLimitError('回答の送信が速すぎます。少し待ってから再試行してください。', 2);
    }

    await submitQuizAnswer(payload.roomId, quizId, payload.playerId, choiceIndex);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'POST /api/rooms/[roomId]/quiz/answer');
  }
}
