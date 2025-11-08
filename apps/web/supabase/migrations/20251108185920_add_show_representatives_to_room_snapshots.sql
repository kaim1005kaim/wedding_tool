-- Add show_representatives column to room_snapshots table
ALTER TABLE room_snapshots
ADD COLUMN IF NOT EXISTS show_representatives boolean DEFAULT false;
