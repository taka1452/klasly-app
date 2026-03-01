-- Add studio_id to waiver_signatures if missing (e.g. table was created before column was added).
-- Backfill from members then set NOT NULL.

ALTER TABLE waiver_signatures ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES studios(id) ON DELETE CASCADE;

UPDATE waiver_signatures ws
SET studio_id = m.studio_id
FROM members m
WHERE ws.member_id = m.id AND ws.studio_id IS NULL;

ALTER TABLE waiver_signatures ALTER COLUMN studio_id SET NOT NULL;
