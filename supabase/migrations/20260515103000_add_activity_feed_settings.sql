-- Activity feed: per-studio alert thresholds + per-profile display preferences.
-- Defaults are merged in application code (src/lib/activity/defaults.ts).

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS activity_feed_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS activity_feed_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN studios.activity_feed_settings IS
  'Activity feed alert thresholds and studio-shared display rules. Owner/Manager(settings) editable. Keys: inactive_member_days, no_show_streak, unpaid_grace_days, waiver_unsigned_after_days, cancellation_rate_threshold, follow_up_after_days, contract_stuck_days.';

COMMENT ON COLUMN profiles.activity_feed_prefs IS
  'Per-profile activity feed display preferences. Keys: hide_read (boolean), default_tab (string).';
