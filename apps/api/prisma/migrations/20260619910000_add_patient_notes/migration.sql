CREATE TABLE "patient_notes" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "content" VARCHAR(800) NOT NULL,
  "image_url" TEXT,
  "admin_id" TEXT,
  "admin_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
