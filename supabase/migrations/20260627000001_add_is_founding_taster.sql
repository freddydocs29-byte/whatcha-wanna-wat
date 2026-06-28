-- Marks users who signed up through the Founding Tasters gate.
-- DEFAULT false — only set to true when founding_taster_access localStorage
-- flag is present at account creation time.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_founding_taster boolean DEFAULT false;
