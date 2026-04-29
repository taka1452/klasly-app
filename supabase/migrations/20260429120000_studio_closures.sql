-- Studio closures: holiday / vacation calendar.
--
-- Owners and managers (with can_manage_settings) can mark specific dates as
-- "closed" so they don't have to cancel each session manually when the studio
-- is closed for a holiday, owner vacation, or building maintenance.
--
-- The cancellation of matching class_sessions is performed at the application
-- layer (POST /api/studio/closures with cancel_sessions=true) so we can also
-- run the existing booking-cancel flow (credit / pass refund + notifications).

CREATE TABLE IF NOT EXISTS studio_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL,
  label TEXT NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT studio_closures_unique_per_day UNIQUE (studio_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_studio_closures_lookup
  ON studio_closures (studio_id, closure_date);

ALTER TABLE studio_closures ENABLE ROW LEVEL SECURITY;

-- Read: any profile in the same studio can see their studio's closures.
DROP POLICY IF EXISTS studio_closures_select ON studio_closures;
CREATE POLICY studio_closures_select
  ON studio_closures
  FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Write: only owner, or manager with can_manage_settings = true.
DROP POLICY IF EXISTS studio_closures_insert ON studio_closures;
CREATE POLICY studio_closures_insert
  ON studio_closures
  FOR INSERT
  WITH CHECK (
    studio_id IN (
      SELECT p.studio_id
      FROM profiles p
      LEFT JOIN managers m ON m.profile_id = p.id
      WHERE p.id = auth.uid()
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND COALESCE(m.can_manage_settings, false) = true)
        )
    )
  );

DROP POLICY IF EXISTS studio_closures_update ON studio_closures;
CREATE POLICY studio_closures_update
  ON studio_closures
  FOR UPDATE
  USING (
    studio_id IN (
      SELECT p.studio_id
      FROM profiles p
      LEFT JOIN managers m ON m.profile_id = p.id
      WHERE p.id = auth.uid()
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND COALESCE(m.can_manage_settings, false) = true)
        )
    )
  );

DROP POLICY IF EXISTS studio_closures_delete ON studio_closures;
CREATE POLICY studio_closures_delete
  ON studio_closures
  FOR DELETE
  USING (
    studio_id IN (
      SELECT p.studio_id
      FROM profiles p
      LEFT JOIN managers m ON m.profile_id = p.id
      WHERE p.id = auth.uid()
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND COALESCE(m.can_manage_settings, false) = true)
        )
    )
  );
