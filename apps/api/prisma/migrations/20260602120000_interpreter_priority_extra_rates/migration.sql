-- Add priority flag and extra_rates JSONB bag to interpreters
ALTER TABLE "interpreters"
  ADD COLUMN "priority"    TEXT,
  ADD COLUMN "extra_rates" JSONB;
