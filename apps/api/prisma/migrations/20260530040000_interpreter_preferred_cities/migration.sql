ALTER TABLE "interpreters" DROP COLUMN IF EXISTS "coverage_range_miles";
ALTER TABLE "interpreters" ADD COLUMN IF NOT EXISTS "preferred_cities" TEXT[] NOT NULL DEFAULT '{}';
