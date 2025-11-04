import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoomSnapshot } from '@wedding_tool/schema';
import { roomSnapshotSchema } from '@wedding_tool/schema';

export function getSupabaseServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Supabase service role client requires URL and service key.');
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function fetchRoomSnapshot(roomId: string) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('room_snapshots')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  const parsed = roomSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

export async function upsertRoomSnapshot(
  roomId: string,
  partial: Partial<Omit<RoomSnapshot, 'room_id'>>
) {
  const client = getSupabaseServiceRoleClient();
  const existing = await fetchRoomSnapshot(roomId);

  const merged: RoomSnapshot = {
    room_id: roomId,
    mode: partial.mode ?? existing?.mode ?? 'idle',
    phase: partial.phase ?? existing?.phase ?? 'idle',
    countdown_ms: partial.countdown_ms ?? existing?.countdown_ms ?? 0,
    leaderboard: partial.leaderboard ?? existing?.leaderboard ?? [],
    current_quiz:
      partial.current_quiz !== undefined ? partial.current_quiz ?? null : existing?.current_quiz ?? null,
    quiz_result:
      partial.quiz_result !== undefined ? partial.quiz_result ?? null : existing?.quiz_result ?? null,
    lottery_result:
      partial.lottery_result !== undefined
        ? partial.lottery_result ?? null
        : existing?.lottery_result ?? null,
    show_ranking: partial.show_ranking ?? existing?.show_ranking ?? false,
    show_celebration: partial.show_celebration ?? existing?.show_celebration ?? false,
    updated_at: new Date().toISOString()
  };

  const { error } = await client.from('room_snapshots').upsert(merged, { onConflict: 'room_id' });

  if (error) {
    throw error;
  }

  return merged;
}
