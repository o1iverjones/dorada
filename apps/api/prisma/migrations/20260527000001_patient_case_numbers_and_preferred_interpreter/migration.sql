-- Replace mrn (single string) with case_numbers (array) and add preferred_interpreter_id

-- 1. Add the new columns
ALTER TABLE "patients" ADD COLUMN "case_numbers" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "patients" ADD COLUMN "preferred_interpreter_id" TEXT;

-- 2. Migrate existing mrn values into case_numbers[0]
UPDATE "patients" SET "case_numbers" = ARRAY[mrn] WHERE mrn IS NOT NULL AND mrn <> '';

-- 3. Add FK constraint for preferred_interpreter_id
ALTER TABLE "patients" ADD CONSTRAINT "patients_preferred_interpreter_id_fkey"
  FOREIGN KEY ("preferred_interpreter_id") REFERENCES "interpreters"("id") ON DELETE SET NULL;

-- 4. Drop the old mrn unique constraint and column
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_organization_id_mrn_key";
ALTER TABLE "patients" DROP COLUMN "mrn";
