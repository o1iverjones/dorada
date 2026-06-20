CREATE TABLE "agency_notes" (
  "id" TEXT NOT NULL,
  "agency_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "content" VARCHAR(800) NOT NULL,
  "image_url" TEXT,
  "admin_id" TEXT,
  "admin_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agency_notes" ADD CONSTRAINT "agency_notes_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_notes" ADD CONSTRAINT "agency_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
