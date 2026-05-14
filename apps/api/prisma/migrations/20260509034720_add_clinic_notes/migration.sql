-- CreateTable
CREATE TABLE "clinic_notes" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content" VARCHAR(800) NOT NULL,
    "admin_id" TEXT,
    "admin_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "clinic_notes" ADD CONSTRAINT "clinic_notes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_notes" ADD CONSTRAINT "clinic_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
