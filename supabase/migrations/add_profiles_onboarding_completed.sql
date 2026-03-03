-- Guided onboarding tour: completion flag + step persistence.
-- Safe to re-run.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

UPDATE profiles
SET onboarding_step = 0
WHERE onboarding_step IS NULL;
