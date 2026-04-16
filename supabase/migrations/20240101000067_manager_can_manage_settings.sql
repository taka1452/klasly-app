-- Add can_manage_settings permission to managers table
ALTER TABLE managers ADD COLUMN IF NOT EXISTS can_manage_settings boolean DEFAULT false;
