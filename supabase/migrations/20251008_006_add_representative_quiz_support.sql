-- Add support for representative-by-table quiz mode and latency tracking

-- Add latency_ms column to answers table
ALTER TABLE answers ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

-- Add is_sudden_death column to quizzes table (for future use)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_sudden_death BOOLEAN DEFAULT FALSE;

-- Create unique index for table-based answer restriction
-- This ensures only one answer per table per quiz when representative mode is ON
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_quiz_table
  ON answers(quiz_id, (
    SELECT table_no FROM players WHERE players.id = answers.player_id
  ))
  WHERE (SELECT table_no FROM players WHERE players.id = answers.player_id) IS NOT NULL;

-- Drop the index since it cannot be created with a subquery
-- We'll enforce this constraint in application logic instead
DROP INDEX IF EXISTS idx_answers_quiz_table;

-- Helper function to check if a table has already answered a quiz
CREATE OR REPLACE FUNCTION check_table_answered(
  p_quiz_id uuid,
  p_table_no text,
  p_room_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM answers a
  JOIN players p ON p.id = a.player_id
  WHERE a.quiz_id = p_quiz_id
    AND p.table_no = p_table_no
    AND p.room_id = p_room_id;

  RETURN v_count > 0;
END;
$$;

-- Update record_quiz_answer function to support representative mode and latency
CREATE OR REPLACE FUNCTION record_quiz_answer(
  p_room_id uuid,
  p_quiz_id uuid,
  p_player_id uuid,
  p_choice integer,
  p_representative_by_table boolean DEFAULT false,
  p_latency_ms integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_no text;
  v_existing_answer_count integer;
BEGIN
  -- Get player's table number
  SELECT table_no INTO v_table_no
  FROM players
  WHERE id = p_player_id AND room_id = p_room_id;

  -- If representative mode is ON, check table_no is not null
  IF p_representative_by_table AND (v_table_no IS NULL OR trim(v_table_no) = '') THEN
    RAISE EXCEPTION 'テーブル番号が必要です';
  END IF;

  -- If representative mode is ON, check if table already answered
  IF p_representative_by_table AND v_table_no IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_answer_count
    FROM answers a
    JOIN players p ON p.id = a.player_id
    WHERE a.quiz_id = p_quiz_id
      AND p.table_no = v_table_no
      AND p.room_id = p_room_id;

    IF v_existing_answer_count > 0 THEN
      RAISE EXCEPTION 'このテーブルは既に回答済みです';
    END IF;
  END IF;

  -- Insert or update answer
  INSERT INTO answers(room_id, quiz_id, player_id, choice_index, latency_ms)
  VALUES (p_room_id, p_quiz_id, p_player_id, p_choice, p_latency_ms)
  ON CONFLICT (quiz_id, player_id)
  DO UPDATE SET
    choice_index = EXCLUDED.choice_index,
    latency_ms = COALESCE(EXCLUDED.latency_ms, answers.latency_ms);
END;
$$;

-- Update reveal_quiz function to include table information in results
CREATE OR REPLACE FUNCTION reveal_quiz(p_room_id uuid, p_quiz_id uuid, p_points integer default 10)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  quiz_data quizzes%rowtype;
  answer record;
  per_choice integer[] := array[0,0,0,0];
  awarded jsonb := '[]'::jsonb;
  result jsonb;
BEGIN
  SELECT * INTO quiz_data FROM quizzes WHERE id = p_quiz_id AND room_id = p_room_id;
  IF quiz_data IS NULL THEN
    RAISE EXCEPTION 'Quiz % not found', p_quiz_id;
  END IF;

  IF EXISTS (SELECT 1 FROM awarded_quizzes WHERE quiz_id = p_quiz_id) THEN
    RAISE EXCEPTION 'Quiz already revealed';
  END IF;

  FOR answer IN
    SELECT
      a.player_id,
      a.choice_index,
      a.latency_ms,
      p.display_name,
      p.table_no
    FROM answers a
    JOIN players p ON p.id = a.player_id
    WHERE a.quiz_id = p_quiz_id
  LOOP
    per_choice[answer.choice_index + 1] := per_choice[answer.choice_index + 1] + 1;
    IF answer.choice_index = quiz_data.answer_index THEN
      INSERT INTO scores(room_id, player_id, total_points, last_update_at)
      VALUES (p_room_id, answer.player_id, p_points, now())
      ON CONFLICT (room_id, player_id)
      DO UPDATE SET total_points = scores.total_points + p_points, last_update_at = now();

      awarded := awarded || jsonb_build_object(
        'playerId', answer.player_id,
        'delta', p_points,
        'displayName', answer.display_name,
        'tableNo', answer.table_no,
        'latencyMs', answer.latency_ms
      );
    END IF;
  END LOOP;

  INSERT INTO awarded_quizzes(quiz_id, room_id, awarded_at)
  VALUES (p_quiz_id, p_room_id, now());

  PERFORM refresh_room_leaderboard(p_room_id);

  result := jsonb_build_object(
    'quizId', p_quiz_id,
    'correctIndex', quiz_data.answer_index,
    'perChoiceCounts', per_choice,
    'awarded', awarded
  );

  INSERT INTO room_snapshots(room_id, quiz_result, updated_at)
  VALUES (p_room_id, result, now())
  ON CONFLICT (room_id)
  DO UPDATE SET quiz_result = EXCLUDED.quiz_result, updated_at = now();

  INSERT INTO admin_audit_logs(room_id, actor, action, payload, created_at)
  VALUES (p_room_id, 'server', 'quiz:reveal', result, now());

  RETURN result;
END;
$$;

-- Update refresh_room_leaderboard to include table_no
CREATE OR REPLACE FUNCTION refresh_room_leaderboard(p_room_id uuid, p_limit int default 20)
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
      p.display_name,
      p.table_no,
      row_number() OVER (ORDER BY s.total_points DESC, s.last_update_at ASC) as rank
    FROM scores s
    JOIN players p ON p.id = s.player_id
    WHERE s.room_id = p_room_id
    ORDER BY s.total_points DESC, s.last_update_at ASC
    LIMIT p_limit
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId', player_id,
    'name', display_name,
    'tableNo', table_no,
    'points', total_points,
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

COMMENT ON COLUMN answers.latency_ms IS 'Response latency in milliseconds from quiz start';
COMMENT ON COLUMN quizzes.is_sudden_death IS 'Whether this quiz is a sudden death (early-press) round';
