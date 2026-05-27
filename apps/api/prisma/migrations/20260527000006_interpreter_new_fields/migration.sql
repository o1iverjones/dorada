ALTER TABLE "interpreters"
  ADD COLUMN "certificate_number"   TEXT,
  ADD COLUMN "zip_code"             TEXT,
  ADD COLUMN "coverage_range_miles" DECIMAL(8,2);
