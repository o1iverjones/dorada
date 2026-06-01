-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "billing_approval_status" TEXT NOT NULL DEFAULT 'pending_approval',
ADD COLUMN     "billing_billed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billing_invoiced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billing_lost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billing_payment_status" TEXT NOT NULL DEFAULT 'not_paid',
ADD COLUMN     "billing_payment_under_claim" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billing_pending_auth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billing_retro" BOOLEAN NOT NULL DEFAULT false;
