-- Member-initiated recurring bookings.
--
-- Lets a member opt into automatic booking for a class template at a
-- specific weekday + start_time slot. Whenever the member loads the
-- calendar (or a future cron runs), Klasly sweeps any class_sessions in
-- range that match the rule and creates bookings if capacity is available
-- and the member doesn't already have one.
--
-- Cancellation of the rule is independent of cancellation of any
-- already-created bookings — those follow the normal booking flow.

CREATE TABLE IF NOT EXISTS recurring_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES class_templates(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  paused_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One rule per (member, template, slot) — re-use updates instead.
  CONSTRAINT recurring_bookings_unique_slot UNIQUE (
    member_id,
    template_id,
    day_of_week,
    start_time
  )
);

CREATE INDEX IF NOT EXISTS idx_recurring_bookings_member
  ON recurring_bookings (member_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_bookings_studio
  ON recurring_bookings (studio_id, is_active);

ALTER TABLE recurring_bookings ENABLE ROW LEVEL SECURITY;

-- Members can read / write their own rules.
DROP POLICY IF EXISTS recurring_bookings_member_select ON recurring_bookings;
CREATE POLICY recurring_bookings_member_select
  ON recurring_bookings
  FOR SELECT
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS recurring_bookings_member_insert ON recurring_bookings;
CREATE POLICY recurring_bookings_member_insert
  ON recurring_bookings
  FOR INSERT
  WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS recurring_bookings_member_update ON recurring_bookings;
CREATE POLICY recurring_bookings_member_update
  ON recurring_bookings
  FOR UPDATE
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS recurring_bookings_member_delete ON recurring_bookings;
CREATE POLICY recurring_bookings_member_delete
  ON recurring_bookings
  FOR DELETE
  USING (member_id = auth.uid());

-- Owners and managers (with can_manage_bookings) can read everyone's
-- rules in their studio so they can troubleshoot why a member ended up
-- in a class. Writes are member-only.
DROP POLICY IF EXISTS recurring_bookings_staff_select ON recurring_bookings;
CREATE POLICY recurring_bookings_staff_select
  ON recurring_bookings
  FOR SELECT
  USING (
    studio_id IN (
      SELECT p.studio_id
      FROM profiles p
      LEFT JOIN managers m ON m.profile_id = p.id
      WHERE p.id = auth.uid()
        AND (
          p.role = 'owner'
          OR (p.role = 'manager' AND COALESCE(m.can_manage_bookings, false) = true)
        )
    )
  );
