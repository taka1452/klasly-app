-- ============================================================
-- Add CHECK constraints for price/amount columns (>= 0)
-- and status columns (valid enum values).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Price/amount >= 0 constraints
-- ────────────────────────────────────────────────────────────
ALTER TABLE appointment_types
  ADD CONSTRAINT chk_appointment_types_price CHECK (price_cents >= 0);

ALTER TABLE appointments
  ADD CONSTRAINT chk_appointments_price CHECK (price_cents >= 0);

ALTER TABLE class_sessions
  ADD CONSTRAINT chk_class_sessions_price CHECK (price_cents IS NULL OR price_cents >= 0);

ALTER TABLE classes
  ADD CONSTRAINT chk_classes_price CHECK (price_cents IS NULL OR price_cents >= 0);

ALTER TABLE event_options
  ADD CONSTRAINT chk_event_options_price CHECK (price_cents >= 0);

ALTER TABLE event_bookings
  ADD CONSTRAINT chk_event_bookings_amount CHECK (total_amount_cents >= 0);

ALTER TABLE event_payment_schedule
  ADD CONSTRAINT chk_event_payment_amount CHECK (amount_cents >= 0);

ALTER TABLE studio_passes
  ADD CONSTRAINT chk_studio_passes_price CHECK (price_cents >= 0);

ALTER TABLE instructor_earnings
  ADD CONSTRAINT chk_earnings_gross CHECK (gross_amount >= 0),
  ADD CONSTRAINT chk_earnings_stripe_fee CHECK (stripe_fee >= 0),
  ADD CONSTRAINT chk_earnings_platform_fee CHECK (platform_fee >= 0),
  ADD CONSTRAINT chk_earnings_studio_fee CHECK (studio_fee >= 0),
  ADD CONSTRAINT chk_earnings_payout CHECK (instructor_payout >= 0);

ALTER TABLE pass_distributions
  ADD CONSTRAINT chk_dist_gross CHECK (gross_pool_amount >= 0),
  ADD CONSTRAINT chk_dist_payout CHECK (payout_amount >= 0);

ALTER TABLE instructor_membership_tiers
  ADD CONSTRAINT chk_tier_price CHECK (monthly_price >= 0);

ALTER TABLE instructors
  ADD CONSTRAINT chk_instructors_rental CHECK (rental_amount >= 0);

ALTER TABLE instructor_overage_charges
  ADD CONSTRAINT chk_overage_charge CHECK (total_charge_cents >= 0);

ALTER TABLE instructor_invoices
  ADD CONSTRAINT chk_invoice_tier CHECK (tier_charge_cents >= 0),
  ADD CONSTRAINT chk_invoice_overage CHECK (overage_charge_cents >= 0),
  ADD CONSTRAINT chk_invoice_flat CHECK (flat_fee_cents >= 0),
  ADD CONSTRAINT chk_invoice_adjustments CHECK (adjustments_cents >= 0),
  ADD CONSTRAINT chk_invoice_total CHECK (total_cents >= 0);

-- members.credits: -1 = unlimited, otherwise >= 0
ALTER TABLE members
  ADD CONSTRAINT chk_members_credits CHECK (credits >= -1);

-- instructor_membership_tiers.monthly_minutes: -1 = unlimited, otherwise >= 0
ALTER TABLE instructor_membership_tiers
  ADD CONSTRAINT chk_tier_minutes CHECK (monthly_minutes >= -1);

-- ────────────────────────────────────────────────────────────
-- 2. Status enum constraints
-- ────────────────────────────────────────────────────────────
ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_status
  CHECK (status IN ('confirmed', 'cancelled', 'waitlist'));

ALTER TABLE members
  ADD CONSTRAINT chk_members_status
  CHECK (status IN ('active', 'paused', 'cancelled'));

ALTER TABLE members
  ADD CONSTRAINT chk_members_rank
  CHECK (current_rank IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

ALTER TABLE instructor_earnings
  ADD CONSTRAINT chk_earnings_status
  CHECK (status IN ('pending', 'paid', 'failed'));

ALTER TABLE pass_subscriptions
  ADD CONSTRAINT chk_pass_sub_status
  CHECK (status IN ('active', 'cancelled', 'past_due'));

ALTER TABLE pass_distributions
  ADD CONSTRAINT chk_pass_dist_status
  CHECK (status IN ('pending', 'approved', 'completed', 'failed'));

ALTER TABLE instructor_memberships
  ADD CONSTRAINT chk_instructor_membership_status
  CHECK (status IN ('active', 'cancelled'));

ALTER TABLE instructor_room_bookings
  ADD CONSTRAINT chk_room_booking_status
  CHECK (status IN ('confirmed', 'cancelled'));

ALTER TABLE instructor_overage_charges
  ADD CONSTRAINT chk_overage_status
  CHECK (status IN ('pending', 'paid', 'waived'));

ALTER TABLE instructor_invoices
  ADD CONSTRAINT chk_invoice_status
  CHECK (status IN ('draft', 'sent', 'paid', 'void'));

ALTER TABLE payments
  ADD CONSTRAINT chk_payments_status
  CHECK (status IN ('paid', 'failed', 'refunded', 'pending'));
