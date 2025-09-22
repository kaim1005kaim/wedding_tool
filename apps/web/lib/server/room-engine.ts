import { getSupabaseServiceRoleClient, upsertRoomSnapshot } from '@/lib/supabase/server';
import { appendAuditLog, ensureRoomSnapshot, updateSnapshotLeaderboard } from '@/lib/server/rooms';

type SupabaseRow<T> = T extends { data: infer U } ? U : never;

const DEFAULT_COUNTDOWN_MS = 10_000;

export async function switchRoomMode(roomId: string, to: 'countup' | 'quiz' | 'lottery' | 'idle') {
  const client = getSupabaseServiceRoleClient();
  await client.from('rooms').update({ mode: to, phase: 'idle' }).eq('id', roomId);
  await ensureRoomSnapshot(roomId);
  await upsertRoomSnapshot(roomId, {
    mode: to,
    phase: 'idle',
    countdown_ms: 0,
    current_quiz: null,
    quiz_result: null
  });
  await appendAuditLog(roomId, 'mode:switch', { to });
}

export async function startGame(roomId: string, countdownMs = DEFAULT_COUNTDOWN_MS) {
  const now = new Date().toISOString();
  const client = getSupabaseServiceRoleClient();
  await client
    .from('rooms')
    .update({ phase: 'running', started_at: now, ended_at: null })
    .eq('id', roomId);

  await ensureRoomSnapshot(roomId);
  await upsertRoomSnapshot(roomId, { phase: 'running', countdown_ms: countdownMs });
  await appendAuditLog(roomId, 'game:start', { countdownMs });
}

export async function stopGame(roomId: string) {
  const now = new Date().toISOString();
  const client = getSupabaseServiceRoleClient();
  await client
    .from('rooms')
    .update({ phase: 'ended', ended_at: now })
    .eq('id', roomId);

  await ensureRoomSnapshot(roomId);
  await upsertRoomSnapshot(roomId, { phase: 'ended', countdown_ms: 0 });
  await appendAuditLog(roomId, 'game:stop', {});
}

export async function applyTapDelta(roomId: string, playerId: string, delta: number) {
  const clamped = Math.max(1, Math.min(30, delta));
  const client = getSupabaseServiceRoleClient();
  const { error } = await client.rpc('apply_tap_delta', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_delta: clamped
  });

  if (error) {
    throw error;
  }
}

export async function submitQuizAnswer(roomId: string, quizId: string, playerId: string, choiceIndex: number) {
  const client = getSupabaseServiceRoleClient();
  const { error } = await client.rpc('record_quiz_answer', {
    p_room_id: roomId,
    p_quiz_id: quizId,
    p_player_id: playerId,
    p_choice: choiceIndex
  });

  if (error) {
    throw error;
  }
}

export async function showQuiz(roomId: string, quizId: string, deadlineTs: number) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('room_id', roomId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Quiz not found');
  }

  await client.from('rooms').update({ mode: 'quiz', phase: 'running' }).eq('id', roomId);
  await ensureRoomSnapshot(roomId);

  await upsertRoomSnapshot(roomId, {
    mode: 'quiz',
    phase: 'running',
    countdown_ms: Math.max(0, deadlineTs - Date.now()),
    current_quiz: {
      quizId,
      question: data.question,
      choices: data.choices ?? [],
      deadlineTs
    },
    quiz_result: null
  });

  await appendAuditLog(roomId, 'quiz:show', { quizId, deadlineTs });
}

export async function showNextQuiz(roomId: string, deadlineMs = DEFAULT_COUNTDOWN_MS) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('quizzes')
    .select('id')
    .eq('room_id', roomId)
    .order('ord', { ascending: true })
    .limit(10);

  if (error || !data || data.length === 0) {
    throw new Error('No quizzes available');
  }

  const awarded = await client
    .from('awarded_quizzes')
    .select('quiz_id')
    .eq('room_id', roomId);

  const awardedSet = new Set((awarded.data ?? []).map((row) => row.quiz_id));
  const next = data.find((row) => !awardedSet.has(row.id));

  if (!next) {
    throw new Error('All quizzes have been revealed');
  }

  const deadlineTs = Date.now() + deadlineMs;
  await showQuiz(roomId, next.id, deadlineTs);
  return next.id;
}

export async function revealQuiz(roomId: string, quizId: string, awardedPoints = 10) {
  const client = getSupabaseServiceRoleClient();
  const { error } = await client.rpc('reveal_quiz', {
    p_room_id: roomId,
    p_quiz_id: quizId,
    p_points: awardedPoints
  });

  if (error) {
    throw error;
  }

  await upsertRoomSnapshot(roomId, { current_quiz: null });
}

export async function drawLottery(roomId: string, kind: 'escort' | 'cake_groom' | 'cake_bride') {
  const client = getSupabaseServiceRoleClient();
  const { error } = await client.rpc('draw_lottery', {
    p_room_id: roomId,
    p_kind: kind
  });

  if (error) {
    throw error;
  }
}

export async function refreshLeaderboardSnapshot(roomId: string, limit = 20) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('scores')
    .select('player_id, total_points, players:players(display_name)')
    .eq('room_id', roomId)
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const entries = (data ?? []).map((row: any, index) => ({
    playerId: row.player_id,
    name: row.players?.display_name ?? 'Unknown',
    points: row.total_points ?? 0,
    rank: index + 1
  }));

  await updateSnapshotLeaderboard(roomId, entries);
}
