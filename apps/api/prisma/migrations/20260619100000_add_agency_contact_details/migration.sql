ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "reporting_contact" TEXT;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "followup_contact" TEXT;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "invoice_contact" TEXT;
