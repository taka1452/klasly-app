-- Studio-scoped announcements: allow owners to create announcements for their studio
-- studio_id IS NULL = global/admin announcement (existing behavior)
-- studio_id IS NOT NULL = studio-scoped owner announcement

ALTER TABLE announcements
  ADD COLUMN studio_id uuid REFERENCES studios(id) ON DELETE CASCADE,
  ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_announcements_studio_id ON announcements(studio_id) WHERE studio_id IS NOT NULL;
