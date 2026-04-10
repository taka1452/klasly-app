-- Make class_sessions.is_online nullable so NULL inherits from classes.is_online
-- This supports the Hybrid model where sessions can individually override the class default

ALTER TABLE class_sessions
  ALTER COLUMN is_online DROP NOT NULL,
  ALTER COLUMN is_online SET DEFAULT NULL;

-- Set existing false values to NULL (inherit from class)
UPDATE class_sessions SET is_online = NULL WHERE is_online = false;
