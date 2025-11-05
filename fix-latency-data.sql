-- Fix negative latencyMs values in room_snapshots.quiz_result
UPDATE room_snapshots
SET quiz_result = jsonb_set(
  quiz_result,
  '{awarded}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'latencyMs')::int < 0
        THEN elem - 'latencyMs' || '{"latencyMs": null}'::jsonb
        ELSE elem
      END
    )
    FROM jsonb_array_elements(quiz_result->'awarded') elem
  )
)
WHERE quiz_result IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(quiz_result->'awarded') elem
    WHERE (elem->>'latencyMs')::int < 0
  );
