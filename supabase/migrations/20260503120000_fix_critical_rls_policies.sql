-- Fix CRITICAL RLS issues:
-- 1. instructor_earnings "Service role" policy uses USING(true) for ALL roles
--    → restrict to service_role only
-- 2. instructor_fee_overrides same issue
-- 3. contract_envelope_signers SELECT exposes sign_token to all studio members
--    → restrict to owner/manager only

-- ============================================================
-- 1. instructor_earnings
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage earnings" ON instructor_earnings;
CREATE POLICY "Service role can manage earnings"
  ON instructor_earnings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 2. instructor_fee_overrides
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage fee overrides" ON instructor_fee_overrides;
CREATE POLICY "Service role can manage fee overrides"
  ON instructor_fee_overrides FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 3. contract_envelope_signers — restrict to staff only
-- ============================================================
DROP POLICY IF EXISTS "contract_envelope_signers_select_own_studio" ON contract_envelope_signers;
CREATE POLICY "contract_envelope_signers_select_staff"
  ON contract_envelope_signers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contract_envelopes e
      JOIN profiles p ON p.studio_id = e.studio_id
      WHERE e.id = contract_envelope_signers.envelope_id
        AND p.id = auth.uid()
        AND p.role IN ('owner', 'manager')
    )
  );
