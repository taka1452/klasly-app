-- Add timezone column to studios table.
-- Defaults to 'Asia/Tokyo' for existing studios (primary user base).
ALTER TABLE studios
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Tokyo';
