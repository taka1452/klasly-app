-- Guided onboarding tour: completion, step persistence, analytics timestamps.
-- Safe to re-run.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE profiles
SET onboarding_step = 0
WHERE onboarding_step IS NULL;
