-- ============================================
-- Waiver tables and trigger
-- Run in Supabase SQL Editor if not using migrations
-- ============================================

-- waiver_templates: one per studio
CREATE TABLE IF NOT EXISTS waiver_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Liability Waiver',
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(studio_id)
);

-- waiver_signatures: one per member invite
CREATE TABLE IF NOT EXISTS waiver_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  sign_token uuid NOT NULL UNIQUE,
  signed_name text DEFAULT '',
  signed_at timestamptz,
  token_used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add waiver columns to members if not exists
ALTER TABLE members ADD COLUMN IF NOT EXISTS waiver_signed boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS waiver_signed_at timestamptz;

-- Trigger: when waiver_signatures is updated with token_used=true, update members
CREATE OR REPLACE FUNCTION update_member_waiver_on_sign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token_used = true AND (OLD.token_used = false OR OLD.token_used IS NULL) THEN
    UPDATE members
    SET waiver_signed = true, waiver_signed_at = NEW.signed_at
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_waiver_signed ON waiver_signatures;
CREATE TRIGGER on_waiver_signed
  AFTER UPDATE ON waiver_signatures
  FOR EACH ROW
  EXECUTE PROCEDURE update_member_waiver_on_sign();

-- RLS
ALTER TABLE waiver_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_signatures ENABLE ROW LEVEL SECURITY;

-- Owner can manage waiver_templates for their studio
CREATE POLICY "owner manage waiver_templates"
ON waiver_templates FOR ALL
USING (
  studio_id IN (SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner')
)
WITH CHECK (
  studio_id IN (SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

-- Owner can view waiver_signatures for their studio
CREATE POLICY "owner view waiver_signatures"
ON waiver_signatures FOR SELECT
USING (
  member_id IN (
    SELECT m.id FROM members m
    JOIN profiles p ON p.studio_id = m.studio_id
    WHERE p.id = auth.uid() AND p.role = 'owner'
  )
);

-- Service role inserts (API uses service role for inserts)
-- No additional policy needed - service role bypasses RLS
