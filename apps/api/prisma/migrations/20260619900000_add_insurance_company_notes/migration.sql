CREATE TABLE "insurance_company_notes" (
  "id" TEXT NOT NULL,
  "insurance_company_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "content" VARCHAR(800) NOT NULL,
  "image_url" TEXT,
  "admin_id" TEXT,
  "admin_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insurance_company_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "insurance_company_notes" ADD CONSTRAINT "insurance_company_notes_insurance_company_id_fkey"
  FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insurance_company_notes" ADD CONSTRAINT "insurance_company_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
