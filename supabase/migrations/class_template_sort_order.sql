-- Add sort_order column to class_templates for drag-and-drop reordering
ALTER TABLE class_templates ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Backfill existing data with sequential sort_order per studio
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY studio_id ORDER BY created_at) AS rn
  FROM class_templates
)
UPDATE class_templates SET sort_order = ranked.rn FROM ranked WHERE class_templates.id = ranked.id;
