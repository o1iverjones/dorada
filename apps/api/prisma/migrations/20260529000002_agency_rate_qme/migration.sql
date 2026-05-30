ALTER TABLE "insurance_agencies"
  ADD COLUMN IF NOT EXISTS "rate_qme" DECIMAL(8,2);
