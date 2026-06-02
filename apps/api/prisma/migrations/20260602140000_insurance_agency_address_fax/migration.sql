-- Add city, state, zip_code, fax to insurance_agencies
ALTER TABLE "insurance_agencies"
  ADD COLUMN "city"     TEXT,
  ADD COLUMN "state"    TEXT,
  ADD COLUMN "zip_code" TEXT,
  ADD COLUMN "fax"      TEXT;
