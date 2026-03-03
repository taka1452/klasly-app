-- Guided onboarding tour completion flag.
-- NOT NULL with default false, safe to re-run.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
