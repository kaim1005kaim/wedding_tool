-- Fix the refresh_room_leaderboard function
DROP FUNCTION IF EXISTS refresh_room_leaderboard(uuid, int);

CREATE OR REPLACE FUNCTION refresh_room_leaderboard(p_room_id uuid, p_limit int default 100)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  entries jsonb;
BEGIN
  WITH ranked_scores AS (
    SELECT
      s.player_id,
      s.total_points,
      s.quiz_points,
      s.countup_tap_count,
      p.display_name,
      p.furigana,
      p.table_no,
      row_number() OVER (ORDER BY s.total_points DESC, s.last_update_at ASC) AS rank
    FROM scores s
    JOIN players p ON p.id = s.player_id
    WHERE s.room_id = p_room_id
    ORDER BY s.total_points DESC, s.last_update_at ASC
    LIMIT p_limit
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId', player_id,
    'name', display_name,
    'furigana', furigana,
    'tableNo', table_no,
    'points', total_points,
    'quizPoints', quiz_points,
    'countupTapCount', countup_tap_count,
    'rank', rank
  ) ORDER BY rank)
  INTO entries
  FROM ranked_scores;

  INSERT INTO room_snapshots(room_id, leaderboard, updated_at)
  VALUES (p_room_id, COALESCE(entries, '[]'::jsonb), now())
  ON CONFLICT (room_id)
  DO UPDATE SET leaderboard = COALESCE(entries, '[]'::jsonb), updated_at = now();
END;
$$;