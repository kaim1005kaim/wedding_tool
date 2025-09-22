-- Add group_tag column to players table for lottery grouping
ALTER TABLE players ADD COLUMN IF NOT EXISTS group_tag TEXT;

-- Set default value for existing players
UPDATE players SET group_tag = 'all' WHERE group_tag IS NULL;