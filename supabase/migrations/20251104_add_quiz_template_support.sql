-- Add support for quiz templates (shared quizzes across all rooms)
-- Quizzes with is_template=true and room_id=null are templates
-- Quizzes with is_template=false and room_id set are room-specific

-- Add is_template column (default false for existing quizzes)
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

-- Make room_id nullable to support templates
ALTER TABLE quizzes
ALTER COLUMN room_id DROP NOT NULL;

-- Add check constraint: templates must have null room_id, non-templates must have room_id
ALTER TABLE quizzes
ADD CONSTRAINT quiz_template_room_constraint
CHECK (
  (is_template = true AND room_id IS NULL) OR
  (is_template = false AND room_id IS NOT NULL)
);

-- Add index for querying templates
CREATE INDEX IF NOT EXISTS idx_quizzes_is_template ON quizzes(is_template) WHERE is_template = true;

-- Add comments
COMMENT ON COLUMN quizzes.is_template IS 'True if this is a shared template quiz, false if room-specific';
COMMENT ON CONSTRAINT quiz_template_room_constraint ON quizzes IS 'Templates have null room_id, room quizzes have non-null room_id';
