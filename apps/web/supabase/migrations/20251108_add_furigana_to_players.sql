-- Add furigana column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS furigana TEXT;

-- Add comment
COMMENT ON COLUMN players.furigana IS 'Player name in hiragana for announcements';
