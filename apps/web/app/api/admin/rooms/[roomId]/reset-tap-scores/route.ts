import { NextResponse } from 'next/server';
import { extractBearerToken } from '@/lib/server/auth-headers';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

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
    // Get all scores for the room with current quiz_points
    const { data: scores, error: fetchError } = await client
      .from('scores')
      .select('player_id, quiz_points')
      .eq('room_id', roomId);

    if (fetchError) {
      throw fetchError;
    }

    // Reset countup_tap_count to 0 and total_points to quiz_points for each player
    if (scores && scores.length > 0) {
      for (const score of scores) {
        const { error: updateError } = await client
          .from('scores')
          .update({
            countup_tap_count: 0,
            total_points: score.quiz_points
          })
          .eq('room_id', roomId)
          .eq('player_id', score.player_id);

        if (updateError) {
          throw updateError;
        }
      }
    }

    // Refresh the leaderboard snapshot
    const { error: refreshError } = await client.rpc('refresh_room_leaderboard', {
      p_room_id: roomId,
      p_limit: 100
    });

    if (refreshError) {
      throw refreshError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to reset tap scores', error);
    return NextResponse.json({ error: 'Failed to reset tap scores' }, { status: 500 });
  }
}
