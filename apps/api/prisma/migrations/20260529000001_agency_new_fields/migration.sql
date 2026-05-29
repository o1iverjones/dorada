ALTER TABLE "insurance_agencies"
  ADD COLUMN "contact_method"  TEXT,
  ADD COLUMN "telephone"       TEXT,
  ADD COLUMN "id_number"       TEXT,
  ADD COLUMN "rate_qualified"  DECIMAL(8,2),
  ADD COLUMN "rate_certified"  DECIMAL(8,2),
  ADD COLUMN "miles"           DECIMAL(8,2),
  ADD COLUMN "reporting_info"  TEXT,
  ADD COLUMN "followup_info"   TEXT,
  ADD COLUMN "invoice_info"    TEXT;
