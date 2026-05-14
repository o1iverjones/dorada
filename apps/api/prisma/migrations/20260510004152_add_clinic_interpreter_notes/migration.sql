-- CreateTable
CREATE TABLE "clinic_interpreter_notes" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'notice',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_interpreter_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "clinic_interpreter_notes" ADD CONSTRAINT "clinic_interpreter_notes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
