-- CreateTable
CREATE TABLE "appointment_media" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "interpreter_id" TEXT NOT NULL,
    "gcs_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_media_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "appointment_media" ADD CONSTRAINT "appointment_media_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_media" ADD CONSTRAINT "appointment_media_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
