-- Nullable for existing accounts. New registration validates and supplies this
-- date inside the existing user + credential transaction, without backfilling.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS date_of_birth date;
