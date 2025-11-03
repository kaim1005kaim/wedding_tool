-- Add buzzer quiz (early-answer quiz) support
-- Players answer as fast as possible, fastest correct answer wins

-- Add answered_at timestamp to track answer speed
ALTER TABLE answers
ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster winner detection (find fastest correct answer)
CREATE INDEX IF NOT EXISTS idx_answers_quiz_answered_at
ON answers(quiz_id, answered_at);

-- Add comment
COMMENT ON COLUMN answers.answered_at IS 'Timestamp when the answer was submitted, used for buzzer quiz to find fastest correct answer';
