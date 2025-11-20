import { NextResponse } from 'next/server';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { appendAuditLog } from '@/lib/server/rooms';

export async function POST(request: Request, props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  const roomId = params.roomId;

  const auth = extractBearerToken(request.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyAdminToken(auth).catch(() => null);
  if (!payload || payload.roomId !== roomId) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 });
  }

  const client = getSupabaseServiceRoleClient();

  try {
    // Delete all answers for this room
    const { error: answersError } = await client
      .from('answers')
      .delete()
      .eq('room_id', roomId);

    if (answersError) {
      console.error('Failed to delete answers:', answersError);
      throw answersError;
    }

    // Delete all scores for this room
    const { error: scoresError } = await client
      .from('scores')
      .delete()
      .eq('room_id', roomId);

    if (scoresError) {
      console.error('Failed to delete scores:', scoresError);
      throw scoresError;
    }

    // Delete all player sessions for this room
    const { error: sessionsError } = await client
      .from('player_sessions')
      .delete()
      .eq('room_id', roomId);

    if (sessionsError) {
      console.error('Failed to delete player sessions:', sessionsError);
      throw sessionsError;
    }

    // Delete all players for this room
    const { error: playersError } = await client
      .from('players')
      .delete()
      .eq('room_id', roomId);

    if (playersError) {
      console.error('Failed to delete players:', playersError);
      throw playersError;
    }

    // Refresh the leaderboard snapshot (should be empty now)
    const { error: refreshError } = await client.rpc('refresh_room_leaderboard', {
      p_room_id: roomId,
      p_limit: 100
    });

    if (refreshError) {
      console.error('Failed to refresh leaderboard:', refreshError);
      throw refreshError;
    }

    // Broadcast state update to notify all clients
    const channel = client.channel(`room:${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'state:update',
      payload: {
        mode: 'idle',
        phase: 'idle',
        serverTime: Date.now(),
        countdownMs: 0,
        leaderboard: [],
        activeQuiz: null,
        quizResult: null,
        lotteryResult: null,
        representatives: [],
        showRanking: false
      }
    });

    // Log the action
    await appendAuditLog(roomId, 'admin:resetUsers', {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to reset users', error);
    return NextResponse.json({ error: 'Failed to reset users' }, { status: 500 });
  }
}
