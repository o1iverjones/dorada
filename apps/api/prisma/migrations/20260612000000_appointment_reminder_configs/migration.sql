-- CreateTable
CREATE TABLE "appointment_reminder_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "offset_minutes" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_reminder_configs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "appointment_reminder_configs" ADD CONSTRAINT "appointment_reminder_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default reminders (24h and 30min) for all existing organisations
INSERT INTO "appointment_reminder_configs" ("id", "organization_id", "offset_minutes", "label", "updated_at")
SELECT gen_random_uuid(), id, 1440, '24 hours before', NOW() FROM "organizations";

INSERT INTO "appointment_reminder_configs" ("id", "organization_id", "offset_minutes", "label", "updated_at")
SELECT gen_random_uuid(), id, 30, '30 minutes before', NOW() FROM "organizations";
