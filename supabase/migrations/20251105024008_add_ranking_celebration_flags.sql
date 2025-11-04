-- Add show_ranking and show_celebration flags to room_snapshots
ALTER TABLE room_snapshots
ADD COLUMN show_ranking BOOLEAN DEFAULT FALSE,
ADD COLUMN show_celebration BOOLEAN DEFAULT FALSE;

-- Update existing snapshots to have false values
UPDATE room_snapshots
SET show_ranking = FALSE, show_celebration = FALSE
WHERE show_ranking IS NULL OR show_celebration IS NULL;
