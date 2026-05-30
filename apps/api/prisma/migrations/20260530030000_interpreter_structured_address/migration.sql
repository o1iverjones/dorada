-- Rename existing address column to address_line1
ALTER TABLE "interpreters" RENAME COLUMN "address" TO "address_line1";

-- Add new address fields
ALTER TABLE "interpreters" ADD COLUMN "address_line2" TEXT;
ALTER TABLE "interpreters" ADD COLUMN "city" TEXT;
ALTER TABLE "interpreters" ADD COLUMN "state" TEXT;
