-- Add image_url column to quizzes table
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN quizzes.image_url IS 'Optional image URL to display with the quiz question (projector view only)';
