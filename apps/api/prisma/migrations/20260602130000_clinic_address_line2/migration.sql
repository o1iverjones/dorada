-- Add address_line2 and parking_instructions to clinics
ALTER TABLE "clinics"
  ADD COLUMN "address_line2"        TEXT,
  ADD COLUMN "parking_instructions" TEXT;
