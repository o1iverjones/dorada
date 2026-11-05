-- Add the new consolidated billing_status column
ALTER TABLE "appointments" ADD COLUMN "billing_status" TEXT NOT NULL DEFAULT 'Pending Approval';

-- Migrate existing data: pick the most advanced billing state
UPDATE "appointments" SET "billing_status" = CASE
  WHEN "billing_payment_status" = 'paid' THEN 'Paid'
  WHEN "billing_billed" = true THEN 'Billed'
  WHEN "billing_invoiced" = true THEN 'Invoiced'
  WHEN "billing_lost" = true THEN 'Lost'
  WHEN "billing_payment_under_claim" = true THEN 'Payment Under Claim'
  WHEN "billing_retro" = true THEN 'Retro'
  WHEN "billing_pending_auth" = true THEN 'Pending Approval'
  WHEN "billing_approval_status" = 'approved' THEN 'Approved'
  ELSE 'Pending Approval'
END;

-- Drop the old columns
ALTER TABLE "appointments" DROP COLUMN "billing_billed";
ALTER TABLE "appointments" DROP COLUMN "billing_invoiced";
ALTER TABLE "appointments" DROP COLUMN "billing_lost";
ALTER TABLE "appointments" DROP COLUMN "billing_payment_under_claim";
ALTER TABLE "appointments" DROP COLUMN "billing_pending_auth";
ALTER TABLE "appointments" DROP COLUMN "billing_retro";
ALTER TABLE "appointments" DROP COLUMN "billing_payment_status";
ALTER TABLE "appointments" DROP COLUMN "billing_approval_status";
