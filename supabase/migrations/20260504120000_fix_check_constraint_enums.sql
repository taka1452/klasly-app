-- ============================================================
-- Fix CHECK constraint enum values that don't match actual code.
-- Three status columns had missing values that would block writes.
-- ============================================================

-- 1. instructor_earnings.status: add 'completed' (Stripe webhook uses it)
ALTER TABLE instructor_earnings
  DROP CONSTRAINT IF EXISTS chk_earnings_status;
ALTER TABLE instructor_earnings
  ADD CONSTRAINT chk_earnings_status
  CHECK (status IN ('pending', 'paid', 'failed', 'completed'));

-- 2. instructor_overage_charges.status: add 'charged' and 'failed'
--    'charged' = Stripe payment succeeded, 'failed' = payment method missing
ALTER TABLE instructor_overage_charges
  DROP CONSTRAINT IF EXISTS chk_overage_status;
ALTER TABLE instructor_overage_charges
  ADD CONSTRAINT chk_overage_status
  CHECK (status IN ('pending', 'paid', 'waived', 'charged', 'failed'));

-- 3. pass_distributions.status: add 'processing' (optimistic lock guard)
ALTER TABLE pass_distributions
  DROP CONSTRAINT IF EXISTS chk_pass_dist_status;
ALTER TABLE pass_distributions
  ADD CONSTRAINT chk_pass_dist_status
  CHECK (status IN ('pending', 'approved', 'completed', 'failed', 'processing'));
