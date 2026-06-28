-- Adds marketing email opt-in flag to profiles.
-- DEFAULT false — never opt-in by default; must be affirmative.
-- Existing rows (anon and authenticated) get false, which is correct.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT false;
