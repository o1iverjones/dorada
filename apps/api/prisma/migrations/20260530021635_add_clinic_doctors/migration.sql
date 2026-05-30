-- DropForeignKey
ALTER TABLE "patients" DROP CONSTRAINT "patients_preferred_interpreter_id_fkey";

-- AlterTable
ALTER TABLE "claims" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "insurance_companies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "clinic_doctors" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_doctors_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_preferred_interpreter_id_fkey" FOREIGN KEY ("preferred_interpreter_id") REFERENCES "interpreters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
