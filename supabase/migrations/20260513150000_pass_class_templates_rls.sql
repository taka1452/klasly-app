-- Enable RLS on pass_class_templates (was missing)
-- All app access is via service_role, so only that policy is needed.
-- Owners/managers get read access for the dashboard pass editor.

ALTER TABLE pass_class_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON pass_class_templates
  FOR ALL TO service_role USING (true);

CREATE POLICY "owners_managers_select" ON pass_class_templates
  FOR SELECT USING (
    pass_id IN (
      SELECT sp.id FROM studio_passes sp
      WHERE sp.studio_id IN (
        SELECT p.studio_id FROM profiles p
        WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
      )
    )
  );
