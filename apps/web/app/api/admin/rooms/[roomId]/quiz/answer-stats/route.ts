import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth/jwt';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  const roomId = params.roomId;
  const quizId = req.nextUrl.searchParams.get('quizId');

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');

  let payload;
  try {
    payload = await verifyAdminToken(token);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.roomId !== roomId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!quizId) {
    return NextResponse.json({ error: 'quizId is required' }, { status: 400 });
  }

  try {
    const client = getSupabaseServiceRoleClient();

    // Quiz is always representative mode (one per table)
    // Get number of unique tables that have answered
    const { data: answeredTables } = await client
      .from('answers')
      .select('player_id')
      .eq('room_id', roomId)
      .eq('quiz_id', quizId);

    // Get unique table numbers from players who answered
    let uniqueTablesAnswered = 0;
    if (answeredTables && answeredTables.length > 0) {
      const playerIds = answeredTables.map(a => a.player_id);
      const { data: players } = await client
        .from('players')
        .select('table_no')
        .in('id', playerIds);

      if (players) {
        const uniqueTables = new Set(players.map(p => p.table_no).filter(t => t !== null));
        uniqueTablesAnswered = uniqueTables.size;
      }
    }

    // Get total number of unique tables in the room
    const { data: allPlayers } = await client
      .from('players')
      .select('table_no')
      .eq('room_id', roomId);

    const totalTables = allPlayers
      ? new Set(allPlayers.map(p => p.table_no).filter(t => t !== null)).size
      : 0;

    return NextResponse.json({
      answered: uniqueTablesAnswered,
      total: totalTables
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
