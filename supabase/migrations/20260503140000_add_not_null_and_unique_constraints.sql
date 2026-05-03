-- ============================================================
-- HIGH: Add NOT NULL + UNIQUE constraints to prevent data
-- integrity issues (orphaned records, duplicates).
-- Pre-check confirmed zero NULLs and zero duplicates in prod.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NOT NULL on studio_id (core tables)
-- ────────────────────────────────────────────────────────────
ALTER TABLE members        ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE instructors    ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE bookings       ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE classes        ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE class_sessions ALTER COLUMN studio_id SET NOT NULL;
ALTER TABLE payments       ALTER COLUMN studio_id SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. NOT NULL on class_sessions columns used in business logic
-- ────────────────────────────────────────────────────────────
ALTER TABLE class_sessions ALTER COLUMN end_time        SET NOT NULL;
ALTER TABLE class_sessions ALTER COLUMN is_public       SET NOT NULL;
ALTER TABLE class_sessions ALTER COLUMN is_cancelled    SET NOT NULL;
ALTER TABLE class_sessions ALTER COLUMN duration_minutes SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. NOT NULL on payments.currency (has DEFAULT 'usd')
-- ────────────────────────────────────────────────────────────
ALTER TABLE payments ALTER COLUMN currency SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. UNIQUE: one member per profile per studio
--    (partial index: only for rows with a profile_id,
--     imported members without profile_id are excluded)
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_members_studio_profile
  ON members (studio_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 5. UNIQUE: one instructor per profile per studio
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_instructors_studio_profile
  ON instructors (studio_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 6. UNIQUE: one active pass subscription per member per pass
--    (partial index: only active subscriptions)
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_pass_subs_active_member_pass
  ON pass_subscriptions (studio_pass_id, member_id)
  WHERE status = 'active';
