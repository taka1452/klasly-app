-- Add template_id to waiver_signatures if missing.
-- Backfill from waiver_templates (one per studio) via members.

ALTER TABLE waiver_signatures ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES waiver_templates(id) ON DELETE CASCADE;

UPDATE waiver_signatures ws
SET template_id = wt.id
FROM waiver_templates wt
JOIN members m ON m.studio_id = wt.studio_id
WHERE ws.member_id = m.id AND ws.template_id IS NULL;

ALTER TABLE waiver_signatures ALTER COLUMN template_id SET NOT NULL;
