-- Add show_representatives flag to room_snapshots
ALTER TABLE room_snapshots
ADD COLUMN IF NOT EXISTS show_representatives BOOLEAN DEFAULT FALSE;

-- Update existing snapshots to have false values
UPDATE room_snapshots
SET show_representatives = FALSE
WHERE show_representatives IS NULL;
