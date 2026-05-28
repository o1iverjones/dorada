-- CreateTable: claims
CREATE TABLE "claims" (
    "id"                  TEXT NOT NULL,
    "organization_id"     TEXT NOT NULL,
    "patient_id"          TEXT NOT NULL,
    "case_number"         TEXT NOT NULL,
    "injury"              TEXT,
    "date_of_injury"      DATE,
    "insurance_agency_id" TEXT,
    "adjuster"            TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
ALTER TABLE "claims" ADD CONSTRAINT "claims_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "claims" ADD CONSTRAINT "claims_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "claims" ADD CONSTRAINT "claims_insurance_agency_id_fkey"
    FOREIGN KEY ("insurance_agency_id") REFERENCES "insurance_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing case_numbers array items into claim rows
INSERT INTO "claims" ("id", "organization_id", "patient_id", "case_number", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    p."organization_id",
    p."id",
    unnest(p."case_numbers"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "patients" p
WHERE array_length(p."case_numbers", 1) > 0;

-- Drop case_numbers column from patients
ALTER TABLE "patients" DROP COLUMN "case_numbers";
