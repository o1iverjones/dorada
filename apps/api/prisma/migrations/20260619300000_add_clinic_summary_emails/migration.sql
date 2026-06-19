-- Add clinic summary email fields to clinics table
ALTER TABLE "clinics" ADD COLUMN "summary_emails_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinics" ADD COLUMN "summary_email_days" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "clinics" ADD COLUMN "summary_email_last_sent_date" TEXT;

-- Add global toggle to system_settings table
ALTER TABLE "system_settings" ADD COLUMN "clinic_summary_emails_enabled" BOOLEAN NOT NULL DEFAULT false;
