-- Per-user calendar subscription token for the iCal (.ics) feed.
--
-- Owners / managers / instructors / members can opt in to subscribing to
-- their own schedule from Google Calendar, Apple Calendar, etc. The token
-- is generated server-side via /api/account/calendar-feed and used in the
-- public-but-unguessable URL /api/ical/<token>.ics. Revoke = clear the
-- column (a regenerate just rewrites it).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendar_feed_token UUID UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_calendar_feed_token
  ON profiles (calendar_feed_token)
  WHERE calendar_feed_token IS NOT NULL;
