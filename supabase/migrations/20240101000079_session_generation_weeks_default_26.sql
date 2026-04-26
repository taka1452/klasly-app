-- Bump the default session-generation lookahead from 8 weeks (~2 months) to
-- 26 weeks (~6 months). Sunrise Yoga (Jamie 2026-04) wanted classes with no
-- end date to be visible roughly half a year ahead. The cron generator runs
-- daily, so moving the default forward keeps a rolling 6-month horizon.
ALTER TABLE studios ALTER COLUMN session_generation_weeks SET DEFAULT 26;

-- Bump every studio that's still at the old default. We deliberately leave
-- studios that explicitly chose a different value (e.g. 12, 52) alone.
UPDATE studios
   SET session_generation_weeks = 26
 WHERE session_generation_weeks IS NULL
    OR session_generation_weeks = 8;
