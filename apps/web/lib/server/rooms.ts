import { getSupabaseServiceRoleClient, upsertRoomSnapshot } from '../supabase/server';
import type {
  AdminAuditLog,
  RoomAdmin,
  RoomSnapshot,
  PlayerSession
} from '@wedding_tool/schema';
import { roomSnapshotSchema } from '@wedding_tool/schema';

export async function fetchRoomAdmin(roomId: string): Promise<RoomAdmin | null> {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('room_admins')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RoomAdmin) ?? null;
}

export async function appendAuditLog(roomId: string, action: string, payload: Record<string, unknown>, actor = 'admin') {
  const client = getSupabaseServiceRoleClient();
  const entry: Omit<AdminAuditLog, 'id'> = {
    room_id: roomId,
    actor,
    action,
    payload,
    created_at: new Date().toISOString()
  };

  const { error } = await client.from('admin_audit_logs').insert(entry);
  if (error) {
    throw error;
  }
}

export async function upsertPlayer({
  roomId,
  displayName,
  furigana,
  tableNo,
  seatNo
}: {
  roomId: string;
  displayName: string;
  furigana?: string | null;
  tableNo?: string | null;
  seatNo?: string | null;
}) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('players')
    .insert({
      room_id: roomId,
      display_name: displayName,
      furigana: furigana ?? null,
      table_no: tableNo ?? null,
      seat_no: seatNo ?? null
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePlayer(playerId: string, payload: Partial<{ display_name: string; furigana: string | null; table_no: string | null; seat_no: string | null }>) {
  const client = getSupabaseServiceRoleClient();
  const { error } = await client.from('players').update(payload).eq('id', playerId);
  if (error) {
    throw error;
  }
}

export async function upsertPlayerSession(session: Omit<PlayerSession, 'id' | 'created_at'>) {
  const client = getSupabaseServiceRoleClient();
  const { error } = await client
    .from('player_sessions')
    .upsert(
      {
        room_id: session.room_id,
        player_id: session.player_id,
        device_fingerprint: session.device_fingerprint ?? null
      },
      {
        onConflict: 'room_id,player_id',
        ignoreDuplicates: false
      }
    );

  if (error) {
    throw error;
  }
}

export async function findPlayerSessionByFingerprint(roomId: string, fingerprint: string) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('player_sessions')
    .select('player_id')
    .eq('room_id', roomId)
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data?.player_id as string | undefined;
}

export async function ensureScoreRecord(roomId: string, playerId: string) {
  const client = getSupabaseServiceRoleClient();
  const { error } = await client
    .from('scores')
    .upsert({ room_id: roomId, player_id: playerId, total_points: 0 }, { onConflict: 'room_id,player_id' });

  if (error) {
    throw error;
  }
}

export async function ensureRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  try {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await client
      .from('room_snapshots')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching room snapshot:', error);
      throw error;
    }

    if (data) {
      const parsed = roomSnapshotSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data;
      } else {
        console.error('Room snapshot validation error:', parsed.error);
        // Try to fix and continue instead of failing
      }
    }
  } catch (error) {
    console.error('ensureRoomSnapshot error:', error);
    // Continue to create a new snapshot
  }

  return upsertRoomSnapshot(roomId, {});
}

export type LeaderboardEntryInput = {
  playerId: string;
  name: string;
  furigana?: string;
  tableNo?: string | null;
  points: number;
  quizPoints?: number;
  countupTapCount?: number;
  rank?: number;
};

export async function updateSnapshotLeaderboard(roomId: string, entries: LeaderboardEntryInput[]) {
  await upsertRoomSnapshot(roomId, {
    leaderboard: entries.map((entry, index) => ({
      playerId: entry.playerId,
      name: entry.name,
      furigana: entry.furigana,
      tableNo: entry.tableNo ?? null,
      points: entry.points,
      quizPoints: entry.quizPoints ?? 0,
      countupTapCount: entry.countupTapCount ?? 0,
      rank: entry.rank ?? index + 1
    }))
  });
}

export async function recomputeLeaderboard(roomId: string, limit = 100) {
  const client = getSupabaseServiceRoleClient();

  console.log('[recomputeLeaderboard] Starting query for roomId:', roomId, 'with limit:', limit);

  const { data, error } = await client
    .from('scores')
    .select('player_id, total_points, quiz_points, countup_tap_count, players:players(display_name, furigana, table_no)')
    .eq('room_id', roomId)
    .order('total_points', { ascending: false })
    .order('player_id', { ascending: true }) // Stable tiebreaker for same scores
    .limit(limit);

  if (error) {
    console.error('[recomputeLeaderboard] Database query error:', error);
    throw error;
  }

  console.log('[recomputeLeaderboard] Raw database response:', {
    roomId,
    count: data?.length ?? 0,
    rawData: JSON.stringify(data, null, 2)
  });

  console.log('[recomputeLeaderboard] Scores data:', {
    roomId,
    count: data?.length ?? 0,
    entries: data?.map(d => ({
      playerId: d.player_id,
      quizPoints: d.quiz_points,
      totalPoints: d.total_points,
      displayName: (d.players as any)?.display_name,
      tableNo: (d.players as any)?.table_no
    }))
  });

  const entries: LeaderboardEntryInput[] = (data ?? []).map((row: any, index) => ({
    playerId: row.player_id,
    name: row.players?.display_name ?? 'Unknown',
    furigana: row.players?.furigana,
    tableNo: row.players?.table_no ?? null,
    points: row.total_points ?? 0,
    quizPoints: row.quiz_points ?? 0,
    countupTapCount: row.countup_tap_count ?? 0,
    rank: index + 1
  }));

  console.log('[recomputeLeaderboard] Mapped leaderboard entries:', {
    roomId,
    count: entries.length,
    entries: entries.map(e => ({
      playerId: e.playerId,
      name: e.name,
      quizPoints: e.quizPoints,
      totalPoints: e.points
    }))
  });

  await updateSnapshotLeaderboard(roomId, entries);

  console.log('[recomputeLeaderboard] Leaderboard updated in snapshot');
}

export async function incrementPlayerScore(roomId: string, playerId: string, delta: number) {
  const client = getSupabaseServiceRoleClient();

  const { data, error } = await client
    .from('scores')
    .select('id, total_points')
    .eq('room_id', roomId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const total = (data?.total_points ?? 0) + delta;

  const mutation = data
    ? client
        .from('scores')
        .update({ total_points: total, last_update_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('player_id', playerId)
    : client
        .from('scores')
        .insert({ room_id: roomId, player_id: playerId, total_points: total });

  const { error: mutationError } = await mutation;
  if (mutationError) {
    throw mutationError;
  }

  return total;
}
