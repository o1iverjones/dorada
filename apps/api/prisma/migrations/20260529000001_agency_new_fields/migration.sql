ALTER TABLE "insurance_agencies"
  ADD COLUMN IF NOT EXISTS "contact_method"  TEXT,
  ADD COLUMN IF NOT EXISTS "telephone"       TEXT,
  ADD COLUMN IF NOT EXISTS "id_number"       TEXT,
  ADD COLUMN IF NOT EXISTS "rate_qualified"  DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "rate_certified"  DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "miles"           DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "reporting_info"  TEXT,
  ADD COLUMN IF NOT EXISTS "followup_info"   TEXT,
  ADD COLUMN IF NOT EXISTS "invoice_info"    TEXT;
