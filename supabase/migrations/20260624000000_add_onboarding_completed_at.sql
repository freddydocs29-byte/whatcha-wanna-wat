-- Adds onboarding_completed_at to profiles.
-- NULL = not completed. No backfill — NULL is the correct safe default for
-- users whose onboarding state is unknown (pre-migration rows).
-- Backwards-compatible: existing route guards fall back to favorite_cuisines.length > 0.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
