-- Rename insurance_agencies table and all related FK columns to "agency"
-- (InsuranceAgency model renamed to Agency throughout the codebase)

ALTER TABLE "insurance_agencies" RENAME TO "agencies";

ALTER TABLE "appointments"    RENAME COLUMN "insurance_agency_id" TO "agency_id";
ALTER TABLE "claims"          RENAME COLUMN "insurance_agency_id" TO "agency_id";
ALTER TABLE "email_intake_logs" RENAME COLUMN "insurance_agency_id" TO "agency_id";
