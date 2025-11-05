-- Remove foreign key constraint from answers table to support hardcoded quizzes
-- This allows quiz_id to reference quizzes that don't exist in the quizzes table

ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_quiz_id_fkey;

-- Add comment explaining why the constraint was removed
COMMENT ON COLUMN answers.quiz_id IS 'Quiz ID - may reference hardcoded quizzes not in quizzes table';
