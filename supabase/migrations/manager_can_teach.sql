-- Allow managers to also teach classes (instructor capabilities)
ALTER TABLE managers ADD COLUMN IF NOT EXISTS can_teach boolean NOT NULL DEFAULT false;
