-- Dashboard-wide per-profile preferences: dismissed cards, collapsed sections, etc.
-- Defaults are merged in application code.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dashboard_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.dashboard_prefs IS
  'Per-profile dashboard preferences. Keys: setup_checklist_dismissed (boolean).';
