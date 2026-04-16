-- ============================================================
-- Add last_active_at to profiles to track the last time a user
-- actually used the app (not just signed in).
--
-- Middleware updates this column in a throttled fashion on
-- authenticated page requests. The admin "User Activity" panel
-- reads this value instead of auth.users.last_sign_in_at so that
-- admins see real activity rather than just the last auth event.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Backfill with last_sign_in_at so existing admin data is meaningful
-- from day one. Safe to re-run.
UPDATE profiles p
SET last_active_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id
  AND p.last_active_at IS NULL
  AND u.last_sign_in_at IS NOT NULL;

-- Partial index to speed up admin activity queries (studio scoped).
CREATE INDEX IF NOT EXISTS idx_profiles_studio_last_active
  ON profiles (studio_id, last_active_at DESC NULLS LAST);
