-- Fix players table columns and add proper defaults

-- Add default value for group_tag
ALTER TABLE players ALTER COLUMN group_tag SET DEFAULT 'all';

-- Add is_present column if it doesn't exist (used in lottery management)
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_present BOOLEAN DEFAULT true;

-- Ensure all existing players have group_tag set
UPDATE players SET group_tag = 'all' WHERE group_tag IS NULL;

-- Ensure all existing players have is_present set
UPDATE players SET is_present = true WHERE is_present IS NULL;