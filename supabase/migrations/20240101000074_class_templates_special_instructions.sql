-- Free-form "Special instructions" field on class templates, requested by
-- Sunrise Yoga Studio (Jamie feedback 2026-04). Used for things like "bring
-- your own mat", "arrive 10 min early", prop lists, accessibility notes, etc.
-- Stored as long text so studios can include structured / multi-paragraph info.
ALTER TABLE class_templates
  ADD COLUMN IF NOT EXISTS special_instructions TEXT;
