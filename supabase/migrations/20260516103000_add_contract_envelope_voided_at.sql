-- Track when a contract envelope was voided so it can appear on a timeline.
-- Existing voided rows are backfilled to created_at as a best-effort proxy
-- (the contract was voided "sometime after" creation; we don't have the
-- exact moment because the previous schema overwrote status in place).

ALTER TABLE contract_envelopes
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;

UPDATE contract_envelopes
SET voided_at = COALESCE(voided_at, created_at)
WHERE status = 'voided' AND voided_at IS NULL;
