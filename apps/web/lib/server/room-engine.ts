import { getSupabaseServiceRoleClient, upsertRoomSnapshot, fetchRoomSnapshot } from '@/lib/supabase/server';
import { appendAuditLog, ensureRoomSnapshot, updateSnapshotLeaderboard, recomputeLeaderboard } from '@/lib/server/rooms';
import { WEDDING_QUIZZES } from '@/lib/hardcoded-quizzes';

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
    lottery_result: null,
    show_ranking: false,
    show_celebration: false
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

  const snapshot = await fetchRoomSnapshot(roomId);

  console.log('[showRanking] Force enabling ranking display:', {
    roomId,
    currentSnapshot: snapshot
  });

  // 常にランキング表示をONにする（トグル動作を廃止）
  // quiz_resultをクリアして正解エフェクトが再生されないようにする
  // current_quizは保持して、次のクイズの順番を維持する
  // modeとphaseを明示的に維持して、idleモードに戻らないようにする
  await upsertRoomSnapshot(roomId, {
    mode: 'quiz',
    phase: 'running',
    show_ranking: true,
    show_celebration: false,
    quiz_result: null
    // current_quizは保持（削除しない）
  });
  await appendAuditLog(roomId, 'game:showRanking', {});

  // Supabaseリアルタイムをトリガーするために、room_snapshotsのupdated_atを更新
  await recomputeLeaderboard(roomId);

  // 更新後の状態を返す
  const updatedSnapshot = await fetchRoomSnapshot(roomId);
  return {
    showRanking: true,
    mode: 'quiz',
    phase: 'running'
  };
}

export async function showCelebration(roomId: string) {
  await ensureRoomSnapshot(roomId);

  // 現在の状態を取得（最新の状態を確実に取得）
  const snapshot = await fetchRoomSnapshot(roomId);
  const isCurrentlyCelebrating = snapshot?.phase === 'celebrating' || snapshot?.show_celebration === true;

  const client = getSupabaseServiceRoleClient();

  if (isCurrentlyCelebrating) {
    // OFFにする: 待機モード(idle)に遷移
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

  // 更新後の状態を返す
  const updatedSnapshot = await fetchRoomSnapshot(roomId);
  return {
    showCelebration: updatedSnapshot?.show_celebration ?? false,
    mode: updatedSnapshot?.mode ?? 'idle',
    phase: updatedSnapshot?.phase ?? 'idle'
  };
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

  console.log('[recordQuizAnswer] Attempting to record answer:', {
    roomId,
    quizId,
    playerId,
    choiceIndex,
    representativeByTable
  });

  // For hardcoded quizzes, insert directly without using RPC function
  // This avoids foreign key constraint on quiz_id
  const { error: insertError } = await client
    .from('answers')
    .upsert({
      room_id: roomId,
      quiz_id: quizId,
      player_id: playerId,
      choice_index: choiceIndex,
      latency_ms: latencyMs,
      answered_at: new Date().toISOString()
    }, {
      onConflict: 'quiz_id,player_id'
    });

  if (insertError) {
    console.error('[recordQuizAnswer] Error:', insertError);
    throw insertError;
  }

  console.log('[recordQuizAnswer] Answer recorded successfully');
}

export async function showQuiz(
  roomId: string,
  quizId: string,
  deadlineTs: number,
  representativeByTable = true,
  suddenDeath: { enabled: boolean; by: 'table' | 'player'; topK: number } | null = null
) {
  const client = getSupabaseServiceRoleClient();

  // Use hardcoded quizzes
  const quiz = WEDDING_QUIZZES.find((q) => q.id === quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  console.log('[showQuiz] Quiz data:', { quizId, question: quiz.question, imageUrl: quiz.imageUrl });

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
      question: quiz.question,
      choices: quiz.choices,
      deadlineTs,
      ord: quiz.ord,
      imageUrl: quiz.imageUrl || null,
      startTs,
      representativeByTable,
      ...(suddenDeath && { suddenDeath })
    },
    quiz_result: null,
    show_ranking: false,
    show_celebration: false
  });

  await appendAuditLog(roomId, 'quiz:show', { quizId, deadlineTs, representativeByTable, suddenDeath });
}

export async function showNextQuiz(
  roomId: string,
  deadlineMs = DEFAULT_COUNTDOWN_MS,
  representativeByTable = true,
  suddenDeath: { enabled: boolean; by: 'table' | 'player'; topK: number } | null = null,
  buzzerMode = false
) {
  // Get already revealed quizzes from room snapshot
  const snapshot = await fetchRoomSnapshot(roomId);

  // For buzzer mode, always start quiz 6 (buzzer quiz)
  let next: typeof WEDDING_QUIZZES[0] | undefined;
  if (buzzerMode) {
    next = WEDDING_QUIZZES.find((quiz) => quiz.ord === 6 && quiz.isBuzzer === true);
    if (!next) {
      throw new Error('Buzzer quiz (quiz 6) not found');
    }
  } else {
    // Track which quizzes have been revealed by checking current_quiz history
    // For simplicity, we'll show quizzes in order and use current_quiz.ord to determine next
    const currentOrd = snapshot?.current_quiz?.ord ?? 0;
    const nextOrd = currentOrd + 1;

    next = WEDDING_QUIZZES.find((quiz) => quiz.ord === nextOrd);

    if (!next) {
      throw new Error('All quizzes have been revealed');
    }
  }

  // For buzzer quiz (quiz 6), set up sudden death for top scorers after quiz 5
  let finalSuddenDeath = suddenDeath;
  if (buzzerMode && next.isBuzzer && next.ord === 6) {
    const client = getSupabaseServiceRoleClient();

    // Get scores after quiz 5 (only counting quiz points)
    const { data: scores } = await client
      .from('scores')
      .select('player_id, quiz_points')
      .eq('room_id', roomId)
      .order('quiz_points', { ascending: false })
      .limit(20);

    if (scores && scores.length > 0) {
      // Find the top quiz_points value
      const topScore = scores[0].quiz_points;

      // Count how many players have the top score
      const topPlayers = scores.filter(s => s.quiz_points === topScore);

      // Set sudden death to only allow top scorers
      finalSuddenDeath = {
        enabled: true,
        by: 'player',
        topK: topPlayers.length
      };

      console.log('[showNextQuiz] Buzzer quiz sudden death:', {
        topScore,
        topPlayersCount: topPlayers.length,
        topPlayerIds: topPlayers.map(p => p.player_id)
      });
    }
  }

  const deadlineTs = Date.now() + deadlineMs;
  await showQuiz(roomId, next.id, deadlineTs, representativeByTable, finalSuddenDeath);
  return next.id;
}

export async function revealQuiz(roomId: string, quizId: string, awardedPoints = 10) {
  const client = getSupabaseServiceRoleClient();

  console.log('[revealQuiz] Starting:', { roomId, quizId, awardedPoints });

  // Get the correct answer from hardcoded quizzes
  const quiz = WEDDING_QUIZZES.find((q) => q.id === quizId);
  if (!quiz) {
    console.error('[revealQuiz] Quiz not found:', quizId);
    throw new Error('Quiz not found');
  }

  console.log('[revealQuiz] Found quiz:', { quizId, answerIndex: quiz.answerIndex });

  // Get all answers for this quiz
  console.log('[revealQuiz] Fetching answers with query:', { roomId, quizId });

  const { data: answers, error: answersError } = await client
    .from('answers')
    .select('player_id, choice_index, answered_at, latency_ms')
    .eq('room_id', roomId)
    .eq('quiz_id', quizId);

  if (answersError) {
    console.error('[revealQuiz] Error fetching answers:', answersError);
    throw answersError;
  }

  console.log('[revealQuiz] Answers fetched:', {
    count: answers?.length ?? 0,
    answersData: answers ? JSON.stringify(answers) : 'null'
  });

  // Award points to correct answers
  if (answers && answers.length > 0) {
    for (const answer of answers) {
      if (answer.choice_index === quiz.answerIndex) {
        // Get current score
        const { data: existingScore } = await client
          .from('scores')
          .select('total_points, quiz_points, countup_tap_count')
          .eq('room_id', roomId)
          .eq('player_id', answer.player_id)
          .single();

        // Award points directly to scores table
        const { error: updateError } = await client
          .from('scores')
          .upsert({
            room_id: roomId,
            player_id: answer.player_id,
            total_points: (existingScore?.total_points || 0) + awardedPoints,
            quiz_points: (existingScore?.quiz_points || 0) + awardedPoints,
            countup_tap_count: existingScore?.countup_tap_count || 0,
            last_update_at: new Date().toISOString()
          }, {
            onConflict: 'room_id,player_id'
          });

        if (updateError) {
          console.error('Failed to award points:', updateError);
        }
      }
    }
  }

  // Mark quiz as awarded
  // Note: Skip this for hardcoded quizzes since they don't exist in the quizzes table
  // We track which quizzes have been awarded by checking the quiz_result in room_snapshots instead
  console.log('[revealQuiz] Skipping awarded_quizzes insert for hardcoded quiz');

  // Count answers per choice
  const perChoiceCounts = [0, 0, 0, 0];
  if (answers) {
    console.log('[revealQuiz] Processing answers:', { count: answers.length });
    for (const answer of answers) {
      console.log('[revealQuiz] Answer:', { playerId: answer.player_id, choiceIndex: answer.choice_index });
      if (answer.choice_index >= 0 && answer.choice_index < 4) {
        perChoiceCounts[answer.choice_index]++;
      }
    }
  }
  console.log('[revealQuiz] Final perChoiceCounts:', perChoiceCounts);

  // Get awarded players info with display names
  const awardedPlayerIds = answers
    ? answers
        .filter((a) => a.choice_index === quiz.answerIndex)
        .map((a) => a.player_id)
    : [];

  // Fetch player details for awarded players
  const awardedPlayers: Array<{
    playerId: string;
    delta: number;
    displayName?: string;
    tableNo?: string | null;
    latencyMs?: number | null;
  }> = [];

  if (awardedPlayerIds.length > 0) {
    console.log('[revealQuiz] Fetching player details for:', awardedPlayerIds);

    const { data: players, error: playersError } = await client
      .from('players')
      .select('id, display_name, table_no')
      .in('id', awardedPlayerIds);

    if (playersError) {
      console.error('[revealQuiz] Error fetching players:', playersError);
      throw playersError;
    }

    console.log('[revealQuiz] Players fetched:', { count: players?.length ?? 0 });

    if (players) {
      for (const player of players) {
        const answer = answers?.find((a) => a.player_id === player.id);
        // Use latency_ms from answers table if available, otherwise null
        const latencyMs = answer?.latency_ms ?? null;

        awardedPlayers.push({
          playerId: player.id,
          delta: awardedPoints,
          displayName: player.display_name ?? undefined,
          tableNo: player.table_no ?? null,
          latencyMs
        });
      }
    }
  }

  console.log('[revealQuiz] Creating quiz result:', {
    quizId,
    correctIndex: quiz.answerIndex,
    perChoiceCounts,
    awardedCount: awardedPlayers.length
  });

  // Update room snapshot with quiz result
  await recomputeLeaderboard(roomId);
  const quizResultData = {
    quizId,
    correctIndex: quiz.answerIndex,
    perChoiceCounts,
    awarded: awardedPlayers
  };

  console.log('[revealQuiz] About to save quiz_result to snapshot:', JSON.stringify(quizResultData));

  await upsertRoomSnapshot(roomId, {
    quiz_result: quizResultData,
    show_ranking: false  // 正解公開時にランキング表示をOFFにする
  });

  console.log('[revealQuiz] Successfully revealed quiz and saved snapshot');

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
