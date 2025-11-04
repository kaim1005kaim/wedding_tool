import { getSupabaseServiceRoleClient, upsertRoomSnapshot, fetchRoomSnapshot } from '@/lib/supabase/server';
import { appendAuditLog, ensureRoomSnapshot, updateSnapshotLeaderboard } from '@/lib/server/rooms';

const DEFAULT_COUNTDOWN_MS = 10_000;
const PREPARATION_TIME_MS = 3_000; // 3秒の準備カウントダウン

export async function resetQuizProgress(roomId: string) {
  const client = getSupabaseServiceRoleClient();

  // Delete quiz-related records
  await client.from('awarded_quizzes').delete().eq('room_id', roomId);
  await client.from('answers').delete().eq('room_id', roomId);

  // Get all scores with current countup_tap_count
  const { data: scores } = await client
    .from('scores')
    .select('player_id, countup_tap_count')
    .eq('room_id', roomId);

  // Reset quiz_points to 0 and total_points to countup_tap_count for each player
  if (scores && scores.length > 0) {
    for (const score of scores) {
      await client
        .from('scores')
        .update({
          quiz_points: 0,
          total_points: score.countup_tap_count
        })
        .eq('room_id', roomId)
        .eq('player_id', score.player_id);
    }
  }

  // Refresh leaderboard snapshot
  await client.rpc('refresh_room_leaderboard', {
    p_room_id: roomId
  });

  // Clear quiz state in snapshot
  await upsertRoomSnapshot(roomId, {
    current_quiz: null,
    quiz_result: null
  });

  await appendAuditLog(roomId, 'quiz:reset', {});
}

export async function switchRoomMode(roomId: string, to: 'countup' | 'quiz' | 'lottery' | 'idle') {
  const client = getSupabaseServiceRoleClient();
  await client.from('rooms').update({ mode: to, phase: 'idle' }).eq('id', roomId);
  await ensureRoomSnapshot(roomId);
  await upsertRoomSnapshot(roomId, {
    mode: to,
    phase: 'idle',
    countdown_ms: 0,
    current_quiz: null,
    quiz_result: null,
    lottery_result: null
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
  // 準備時間を追加（3-2-1カウントダウン用）
  await upsertRoomSnapshot(roomId, { phase: 'running', countdown_ms: countdownMs + PREPARATION_TIME_MS });
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
  await upsertRoomSnapshot(roomId, { phase: 'ended', countdown_ms: 0, show_ranking: false, show_celebration: false });
  await appendAuditLog(roomId, 'game:stop', {});
}

export async function showRanking(roomId: string) {
  await ensureRoomSnapshot(roomId);

  // 現在の状態を取得
  const snapshot = await fetchRoomSnapshot(roomId);
  const isCurrentlyShowingRanking = snapshot?.show_ranking === true;

  if (isCurrentlyShowingRanking) {
    // OFFにする: 待機モード(idle)に遷移
    const client = getSupabaseServiceRoleClient();
    await client.from('rooms').update({ mode: 'idle', phase: 'idle' }).eq('id', roomId);
    await upsertRoomSnapshot(roomId, {
      mode: 'idle',
      phase: 'idle',
      show_ranking: false,
      show_celebration: false
    });
    await appendAuditLog(roomId, 'game:hideRanking', {});
  } else {
    // ONにする: ランキングを表示
    await upsertRoomSnapshot(roomId, { show_ranking: true, show_celebration: false });
    await appendAuditLog(roomId, 'game:showRanking', {});
  }
}

export async function showCelebration(roomId: string) {
  await ensureRoomSnapshot(roomId);

  // 現在の状態を取得
  const snapshot = await fetchRoomSnapshot(roomId);
  const isCurrentlyCelebrating = snapshot?.phase === 'celebrating' || snapshot?.show_celebration === true;

  if (isCurrentlyCelebrating) {
    // OFFにする: 待機モード(idle)に遷移
    const client = getSupabaseServiceRoleClient();
    await client.from('rooms').update({ mode: 'idle', phase: 'idle' }).eq('id', roomId);
    await upsertRoomSnapshot(roomId, {
      mode: 'idle',
      phase: 'idle',
      show_celebration: false,
      show_ranking: false
    });
    await appendAuditLog(roomId, 'game:hideCelebration', {});
  } else {
    // ONにする: 表彰中画面を表示
    await upsertRoomSnapshot(roomId, { phase: 'celebrating', show_celebration: true });
    await appendAuditLog(roomId, 'game:showCelebration', {});
  }
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

  // Get current quiz snapshot to check representative mode and calculate latency
  const { data: snapshot } = await client
    .from('room_snapshots')
    .select('current_quiz')
    .eq('room_id', roomId)
    .maybeSingle();

  const currentQuiz = snapshot?.current_quiz;
  const representativeByTable = currentQuiz?.representativeByTable ?? false;
  const startTs = currentQuiz?.startTs;
  const latencyMs = startTs ? Date.now() - startTs : null;

  // Get player's table number for representative check
  const { data: player } = await client
    .from('players')
    .select('table_no')
    .eq('id', playerId)
    .eq('room_id', roomId)
    .maybeSingle();

  // If representative mode is ON, check if table_no exists
  if (representativeByTable) {
    if (!player?.table_no || player.table_no.trim() === '') {
      throw new Error('テーブル番号が必要です');
    }

    // Check if this table already answered using raw SQL query
    const { data: existingAnswers } = await client.rpc('check_table_answered', {
      p_quiz_id: quizId,
      p_table_no: player.table_no,
      p_room_id: roomId
    });

    if (existingAnswers) {
      throw new Error('このテーブルは既に回答済みです');
    }
  }

  const { error } = await client.rpc('record_quiz_answer', {
    p_room_id: roomId,
    p_quiz_id: quizId,
    p_player_id: playerId,
    p_choice: choiceIndex,
    p_representative_by_table: representativeByTable,
    p_latency_ms: latencyMs
  });

  if (error) {
    throw error;
  }
}

export async function showQuiz(
  roomId: string,
  quizId: string,
  deadlineTs: number,
  representativeByTable = true,
  suddenDeath: { enabled: boolean; by: 'table' | 'player'; topK: number } | null = null
) {
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

  const startTs = Date.now();

  // Clear previous quiz result when starting new quiz
  await upsertRoomSnapshot(roomId, {
    mode: 'quiz',
    phase: 'running',
    countdown_ms: Math.max(0, deadlineTs - startTs),
    current_quiz: {
      quizId,
      question: data.question,
      choices: data.choices ?? [],
      deadlineTs,
      ord: data.ord ?? null,
      imageUrl: data.image_url ?? null,
      startTs,
      representativeByTable,
      ...(suddenDeath && { suddenDeath })
    },
    quiz_result: null
  });

  await appendAuditLog(roomId, 'quiz:show', { quizId, deadlineTs, representativeByTable, suddenDeath });
}

export async function showNextQuiz(
  roomId: string,
  deadlineMs = DEFAULT_COUNTDOWN_MS,
  representativeByTable = true,
  suddenDeath: { enabled: boolean; by: 'table' | 'player'; topK: number } | null = null
) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('quizzes')
    .select('id, ord')
    .eq('room_id', roomId)
    .order('ord', { ascending: true })
    

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
  await showQuiz(roomId, next.id, deadlineTs, representativeByTable, suddenDeath);
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

  // Keep current_quiz visible - it will be cleared when next quiz starts
  // await upsertRoomSnapshot(roomId, { current_quiz: null });
}

export async function revealBuzzerQuiz(roomId: string, quizId: string, awardedPoints = 10) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client.rpc('reveal_buzzer_quiz', {
    p_room_id: roomId,
    p_quiz_id: quizId,
    p_points: awardedPoints
  });

  if (error) {
    throw error;
  }

  return data as { winnerId: string | null; awarded: Array<{ playerId: string; delta: number; answeredAt: string }> };
}

export async function drawLottery(roomId: string, kind: 'all' | 'groom' | 'bride') {
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
    .select('player_id, total_points, quiz_points, countup_tap_count, players:players(display_name)')
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
    quizPoints: row.quiz_points ?? 0,
    countupTapCount: row.countup_tap_count ?? 0,
    rank: index + 1
  }));

  await updateSnapshotLeaderboard(roomId, entries);
}
