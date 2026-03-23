-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

  email_booking_confirmation boolean DEFAULT true,
  email_booking_cancellation boolean DEFAULT true,
  email_class_changes boolean DEFAULT true,
  email_payment_receipts boolean DEFAULT true,
  email_waiver_requests boolean DEFAULT true,
  email_new_messages boolean DEFAULT true,
  email_waitlist_promotion boolean DEFAULT true,
  email_event_reminders boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (profile_id, studio_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile
  ON notification_preferences(profile_id, studio_id);
