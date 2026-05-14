-- CreateTable
CREATE TABLE "appointment_activities" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "admin_id" TEXT,
    "admin_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_notes" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content" VARCHAR(800) NOT NULL,
    "admin_id" TEXT,
    "admin_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "appointment_activities" ADD CONSTRAINT "appointment_activities_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_activities" ADD CONSTRAINT "appointment_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
