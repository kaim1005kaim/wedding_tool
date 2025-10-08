-- Fix rooms table schema for API compatibility

-- Add updated_at column if it doesn't exist
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Remove mode and phase from rooms table if they exist (they should be in room_snapshots only)
ALTER TABLE rooms DROP COLUMN IF EXISTS mode;
ALTER TABLE rooms DROP COLUMN IF EXISTS phase;

-- Add comment to clarify schema
COMMENT ON TABLE rooms IS 'Rooms table - contains only basic room info. Mode/phase are in room_snapshots.';
COMMENT ON COLUMN rooms.code IS 'Unique 4-character room code for joining';
COMMENT ON COLUMN rooms.created_at IS 'When the room was created';
COMMENT ON COLUMN rooms.updated_at IS 'Last update timestamp';
