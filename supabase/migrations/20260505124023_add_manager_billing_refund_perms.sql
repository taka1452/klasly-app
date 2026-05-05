-- Add two new toggleable manager permissions:
--   can_manage_billing  – Klasly subscription / billing portal / promo codes.
--                          Stripe Connect (payout destination) stays owner-only.
--   can_issue_refunds   – process Stripe refunds via event / booking cancel
--                          flows. (Day-to-day booking ops are still gated by
--                          can_manage_bookings.)
--
-- Both default to FALSE so existing managers do not silently gain financial
-- power on migration.

ALTER TABLE public.managers
  ADD COLUMN IF NOT EXISTS can_manage_billing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_issue_refunds boolean NOT NULL DEFAULT false;
