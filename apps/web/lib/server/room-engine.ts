import { getSupabaseServiceRoleClient, upsertRoomSnapshot } from '@/lib/supabase/server';
import {
  appendAuditLog,
  ensureRoomSnapshot,
  ensureScoreRecord,
  incrementPlayerScore,
  recomputeLeaderboard,
  updateSnapshotLeaderboard
} from '@/lib/server/rooms';

type SupabaseRow<T> = T extends { data: infer U } ? U : never;

const DEFAULT_COUNTDOWN_MS = 30_000;

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
  await ensureScoreRecord(roomId, playerId);
  await incrementPlayerScore(roomId, playerId, clamped);
  await recomputeLeaderboard(roomId);
}

export async function submitQuizAnswer(roomId: string, quizId: string, playerId: string, choiceIndex: number) {
  const client = getSupabaseServiceRoleClient();
  await client.from('answers').upsert(
    {
      room_id: roomId,
      quiz_id: quizId,
      player_id: playerId,
      choice_index: choiceIndex
    },
    { onConflict: 'quiz_id,player_id' }
  );
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

  const { data: quiz, error: quizError } = await client
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('room_id', roomId)
    .maybeSingle();

  if (quizError || !quiz) {
    throw new Error('Quiz not found');
  }

  const existingAward = await client
    .from('awarded_quizzes')
    .select('*')
    .eq('quiz_id', quizId)
    .maybeSingle();

  if (existingAward.data) {
    throw new Error('Quiz already revealed');
  }

  const { data: answers } = await client
    .from('answers')
    .select('player_id, choice_index, players:players(display_name)')
    .eq('quiz_id', quizId);

  const perChoiceCounts = [0, 0, 0, 0];
  const awarded: { playerId: string; delta: number }[] = [];

  (answers ?? []).forEach((answer: any) => {
    perChoiceCounts[answer.choice_index] += 1;
    if (answer.choice_index === quiz.answer_index) {
      awarded.push({ playerId: answer.player_id, delta: awardedPoints });
    }
  });

  for (const winner of awarded) {
    await incrementPlayerScore(roomId, winner.playerId, winner.delta);
  }

  await client.from('awarded_quizzes').insert({ quiz_id: quizId, room_id: roomId, awarded_at: new Date().toISOString() });

  await recomputeLeaderboard(roomId);

  await upsertRoomSnapshot(roomId, {
    quiz_result: {
      quizId,
      correctIndex: quiz.answer_index,
      perChoiceCounts,
      awarded
    }
  });

  await appendAuditLog(roomId, 'quiz:reveal', { quizId, awardedPoints, winners: awarded.map((w) => w.playerId) });
}

export async function drawLottery(roomId: string, kind: 'escort' | 'cake_groom' | 'cake_bride') {
  const client = getSupabaseServiceRoleClient();

  const { data: existing } = await client
    .from('lottery_picks')
    .select('player_id')
    .eq('room_id', roomId)
    .eq('kind', kind)
    .maybeSingle();

  if (existing) {
    throw new Error(`Lottery ${kind} already drawn`);
  }

  const { data: players, error: playersError } = await client
    .from('players')
    .select('id, display_name, table_no, seat_no, is_present')
    .eq('room_id', roomId)
    .eq('is_present', true);

  if (playersError) {
    throw playersError;
  }

  const { data: picks } = await client
    .from('lottery_picks')
    .select('player_id')
    .eq('room_id', roomId);

  const taken = new Set((picks ?? []).map((row) => row.player_id));
  const candidates = (players ?? []).filter((player: any) => !taken.has(player.id));

  if (candidates.length === 0) {
    throw new Error('No eligible players for lottery');
  }

  const winner = candidates[Math.floor(Math.random() * candidates.length)];

  const { error: insertError } = await client
    .from('lottery_picks')
    .insert({ room_id: roomId, kind, player_id: winner.id });

  if (insertError) {
    throw insertError;
  }

  await upsertRoomSnapshot(roomId, {
    lottery_result: {
      kind,
      player: {
        id: winner.id,
        name: winner.display_name,
        table_no: winner.table_no ?? null,
        seat_no: winner.seat_no ?? null
      }
    }
  });

  await appendAuditLog(roomId, 'lottery:draw', {
    kind,
    winner: {
      id: winner.id,
      name: winner.display_name
    }
  });
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
