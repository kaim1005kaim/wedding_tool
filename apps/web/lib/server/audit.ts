import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function fetchAuditLogs(roomId: string, limit = 50) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('admin_audit_logs')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchLotteryHistory(roomId: string, limit = 20) {
  const client = getSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('lottery_picks')
    .select('kind, created_at, players:players(display_name, table_no, seat_no)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}
