-- apply_tap_delta関数を更新して、リーダーボードの更新頻度を制限する
-- 0.5秒に1回のみ refresh_room_leaderboard を呼び出す

CREATE OR REPLACE FUNCTION apply_tap_delta(p_room_id uuid, p_player_id uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  clamped integer := greatest(1, least(30, p_delta));
  last_update timestamptz;
BEGIN
  -- スコアの更新（これは常に即座に行う）
  INSERT INTO scores(room_id, player_id, total_points, countup_tap_count, last_update_at)
  VALUES (p_room_id, p_player_id, clamped, clamped, now())
  ON CONFLICT (room_id, player_id)
  DO UPDATE SET
    total_points = scores.total_points + clamped,
    countup_tap_count = scores.countup_tap_count + clamped,
    last_update_at = now();

  -- 前回のスナップショット更新時刻を取得
  SELECT updated_at INTO last_update FROM room_snapshots WHERE room_id = p_room_id;

  -- スロットリング: 前回の更新から0.5秒以上経過している場合、または初回の場合のみリーダーボードを更新
  IF last_update IS NULL OR EXTRACT(EPOCH FROM (now() - last_update)) > 0.5 THEN
    PERFORM refresh_room_leaderboard(p_room_id);
  END IF;
END;
$$;
