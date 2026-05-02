-- Allow room-only bookings (session_type='room_only') to be linked to a
-- specific member, optionally consuming a session from their pass.
-- Sarah Haroldsen feedback (2026-05): private 1:1 sessions like Body Therapy
-- and Reiki need to deduct from the client's package automatically.

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS client_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_pass_subscription_id uuid REFERENCES pass_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_sessions_client_member
  ON class_sessions (client_member_id)
  WHERE client_member_id IS NOT NULL;
