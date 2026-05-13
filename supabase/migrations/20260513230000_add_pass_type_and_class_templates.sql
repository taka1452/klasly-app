-- Add pass_type and expires_after_days columns to studio_passes,
-- and create pass_class_templates table for class restrictions.

-- 1. Add pass_type column (replaces billing_interval concept for UI/API)
ALTER TABLE studio_passes
  ADD COLUMN IF NOT EXISTS pass_type text NOT NULL DEFAULT 'monthly';

-- Backfill: map existing billing_interval values to pass_type
UPDATE studio_passes SET pass_type = 'monthly' WHERE billing_interval = 'month';

-- 2. Add expires_after_days for relative expiration (e.g., 30 days from purchase)
ALTER TABLE studio_passes
  ADD COLUMN IF NOT EXISTS expires_after_days integer;

-- 3. Create pass_class_templates for restricting passes to specific classes
CREATE TABLE IF NOT EXISTS pass_class_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES studio_passes(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES class_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pass_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_pass_class_templates_pass_id
  ON pass_class_templates(pass_id);

CREATE INDEX IF NOT EXISTS idx_pass_class_templates_template_id
  ON pass_class_templates(template_id);

ALTER TABLE pass_class_templates ENABLE ROW LEVEL SECURITY;

-- Owners and managers can manage restrictions
CREATE POLICY "staff manage pass_class_templates" ON pass_class_templates
  FOR ALL USING (
    pass_id IN (
      SELECT sp.id FROM studio_passes sp
      JOIN profiles p ON p.studio_id = sp.studio_id
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
    )
  );

-- Members can view restrictions (needed for booking flow to know which passes apply)
CREATE POLICY "member view pass_class_templates" ON pass_class_templates
  FOR SELECT USING (
    pass_id IN (
      SELECT sp.id FROM studio_passes sp
      JOIN members m ON m.studio_id = sp.studio_id
      WHERE m.profile_id = auth.uid()
    )
  );

-- Service role bypass for server-side booking logic
CREATE POLICY "service role bypass pass_class_templates" ON pass_class_templates
  FOR ALL USING (auth.role() = 'service_role');
