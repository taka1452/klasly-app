-- Add recurrence_end_date and transition_minutes to class_templates
ALTER TABLE class_templates
  ADD COLUMN IF NOT EXISTS recurrence_end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transition_minutes integer DEFAULT NULL;

COMMENT ON COLUMN class_templates.recurrence_end_date IS 'Date after which weekly recurring sessions stop being generated';
COMMENT ON COLUMN class_templates.transition_minutes IS 'Buffer time in minutes between consecutive sessions (5, 10, 15, or 30)';
