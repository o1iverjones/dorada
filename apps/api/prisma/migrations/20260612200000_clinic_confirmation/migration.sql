ALTER TABLE "appointments" ADD COLUMN "clinic_confirmed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "system_settings" ADD COLUMN "clinic_confirmation_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "system_settings" ADD COLUMN "clinic_confirmation_time" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "system_settings" ADD COLUMN "clinic_confirmation_last_sent_date" TEXT;
