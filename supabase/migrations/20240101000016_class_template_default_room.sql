-- Add default room_id to class_templates
-- This allows templates to have a pre-assigned room that auto-fills when scheduling sessions

ALTER TABLE class_templates
  ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_class_templates_room_id ON class_templates(room_id);
