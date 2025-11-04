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
  const valid = await verifyAdminToken(token, roomId);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!quizId) {
    return NextResponse.json({ error: 'quizId is required' }, { status: 400 });
  }

  try {
    const client = getSupabaseServiceRoleClient();

    // Get total number of players in the room
    const { count: totalPlayers } = await client
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    // Get number of players who answered this quiz
    const { count: answeredPlayers } = await client
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('quiz_id', quizId);

    return NextResponse.json({
      answered: answeredPlayers ?? 0,
      total: totalPlayers ?? 0
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
