-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "plan" TEXT NOT NULL DEFAULT 'standard',
    "intake_email_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "fcm_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "follow_up_notification" TEXT NOT NULL DEFAULT 'queue_only',
    "email_intake_notification" TEXT NOT NULL DEFAULT 'queue_only',
    "digest_times" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "interpreter_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpreters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL,
    "languages" TEXT[],
    "profile_picture_url" TEXT,
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "pay_rate" DECIMAL(10,2),
    "payment_method" TEXT,
    "address" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "follow_up_channel" TEXT NOT NULL DEFAULT 'push',
    "fcm_token" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interpreters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpreter_availability" (
    "id" TEXT NOT NULL,
    "interpreter_id" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interpreter_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_phone" TEXT,
    "primary_contact_email" TEXT,
    "billing_model" TEXT NOT NULL,
    "billing_hourly_rate" DECIMAL(10,2),
    "billing_flat_rate" DECIMAL(10,2),
    "billing_invoice_cycle" TEXT NOT NULL DEFAULT 'monthly',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_interpreter_blocks" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "interpreter_id" TEXT NOT NULL,

    CONSTRAINT "clinic_interpreter_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_agencies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_phone" TEXT,
    "primary_contact_email" TEXT,
    "notes" TEXT,
    "email_intake_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_intake_sender_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email_intake_confirmation_override" TEXT,
    "email_intake_reply_template" TEXT,
    "email_intake_reply_from_name" TEXT,
    "email_intake_reply_from_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mrn" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "preferred_language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pay_model" TEXT NOT NULL,
    "minimum_billable_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_offer',
    "date_time" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "type_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "interpreter_type_required" TEXT NOT NULL,
    "interpreter_id" TEXT,
    "clinic_id" TEXT NOT NULL,
    "insurance_agency_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "referring_physician" TEXT,
    "department" TEXT,
    "pre_auth_amount" DECIMAL(10,2) NOT NULL,
    "pre_auth_mileage" INTEGER NOT NULL DEFAULT 0,
    "po_number" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "clock_in_time" TIMESTAMP(3),
    "clock_out_time" TIMESTAMP(3),
    "actual_duration_minutes" INTEGER,
    "billable_duration_minutes" INTEGER,
    "pay_rate" DECIMAL(10,2),
    "follow_up_status" TEXT,
    "shift_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_offers" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "interpreter_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "offered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "appointment_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_responses" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "interpreter_id" TEXT NOT NULL,
    "has_follow_up" BOOLEAN NOT NULL,
    "same_physician" BOOLEAN,
    "same_clinic" BOOLEAN,
    "follow_up_datetime" TEXT,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_media" (
    "id" TEXT NOT NULL,
    "follow_up_response_id" TEXT NOT NULL,
    "gcs_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_drafts" (
    "id" TEXT NOT NULL,
    "follow_up_response_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_intake_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "insurance_agency_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "from_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message_id" TEXT,
    "body_text" TEXT,
    "raw_email_gcs_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "has_unresolved_fields" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_po" BOOLEAN NOT NULL DEFAULT false,
    "error_detail" TEXT,
    "confirmation_method" TEXT,
    "confirmation_status" TEXT,
    "confirmation_error" TEXT,
    "confirmation_screenshot_gcs_path" TEXT,
    "confirmation_executed_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_intake_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_intake_extractions" (
    "id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extracted_fields" JSONB NOT NULL,
    "confidence_scores" JSONB NOT NULL,
    "unresolved_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "email_intake_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_intake_drafts" (
    "id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "has_unresolved_fields" BOOLEAN NOT NULL DEFAULT false,
    "unresolved_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "po_number" TEXT,
    "extracted_patient_name" TEXT,
    "extracted_clinic_name" TEXT,
    "extracted_doctor_name" TEXT,
    "extracted_date_time" TEXT,
    "extracted_languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_intake_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "filters" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gcs_path" TEXT,
    "download_url" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "interpreter_id" TEXT NOT NULL,
    "sender_type" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_languages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "organization_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale_strings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "locale_strings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "default_pay_rate_certified" DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    "default_pay_rate_qualified" DECIMAL(10,2) NOT NULL DEFAULT 30.00,
    "offer_expiry_default_minutes" INTEGER NOT NULL DEFAULT 60,
    "follow_up_reminder_window_minutes" INTEGER NOT NULL DEFAULT 60,
    "follow_up_max_reminders" INTEGER NOT NULL DEFAULT 2,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admin_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email_polling_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "claude_model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "llm_prompt_version" TEXT NOT NULL DEFAULT 'v1.0',
    "imap_host" TEXT,
    "imap_user" TEXT,
    "imap_password" TEXT,
    "max_confirmation_retries" INTEGER NOT NULL DEFAULT 3,
    "playwright_timeout_seconds" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_intake_email_address_key" ON "organizations"("intake_email_address");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_key" ON "role_permissions"("role_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "interpreters_organization_id_phone_key" ON "interpreters"("organization_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_interpreter_blocks_clinic_id_interpreter_id_key" ON "clinic_interpreter_blocks"("clinic_id", "interpreter_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_organization_id_mrn_key" ON "patients"("organization_id", "mrn");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_offers_appointment_id_interpreter_id_key" ON "appointment_offers"("appointment_id", "interpreter_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_responses_appointment_id_key" ON "follow_up_responses"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_drafts_follow_up_response_id_key" ON "follow_up_drafts"("follow_up_response_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_drafts_appointment_id_key" ON "follow_up_drafts"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_intake_extractions_log_id_key" ON "email_intake_extractions"("log_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_intake_drafts_log_id_key" ON "email_intake_drafts"("log_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_intake_drafts_appointment_id_key" ON "email_intake_drafts"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_languages_organization_id_code_key" ON "organization_languages"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "locale_strings_organization_id_locale_key_key" ON "locale_strings"("organization_id", "locale", "key");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_organization_id_key" ON "system_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "super_admin_settings_organization_id_key" ON "super_admin_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpreters" ADD CONSTRAINT "interpreters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpreter_availability" ADD CONSTRAINT "interpreter_availability_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_interpreter_blocks" ADD CONSTRAINT "clinic_interpreter_blocks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_interpreter_blocks" ADD CONSTRAINT "clinic_interpreter_blocks_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agencies" ADD CONSTRAINT "insurance_agencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "appointment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_insurance_agency_id_fkey" FOREIGN KEY ("insurance_agency_id") REFERENCES "insurance_agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_offers" ADD CONSTRAINT "appointment_offers_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_offers" ADD CONSTRAINT "appointment_offers_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_responses" ADD CONSTRAINT "follow_up_responses_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_responses" ADD CONSTRAINT "follow_up_responses_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_media" ADD CONSTRAINT "follow_up_media_follow_up_response_id_fkey" FOREIGN KEY ("follow_up_response_id") REFERENCES "follow_up_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_drafts" ADD CONSTRAINT "follow_up_drafts_follow_up_response_id_fkey" FOREIGN KEY ("follow_up_response_id") REFERENCES "follow_up_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_drafts" ADD CONSTRAINT "follow_up_drafts_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_intake_logs" ADD CONSTRAINT "email_intake_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_intake_logs" ADD CONSTRAINT "email_intake_logs_insurance_agency_id_fkey" FOREIGN KEY ("insurance_agency_id") REFERENCES "insurance_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_intake_extractions" ADD CONSTRAINT "email_intake_extractions_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "email_intake_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_intake_drafts" ADD CONSTRAINT "email_intake_drafts_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "email_intake_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_intake_drafts" ADD CONSTRAINT "email_intake_drafts_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_interpreter_id_fkey" FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_languages" ADD CONSTRAINT "organization_languages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locale_strings" ADD CONSTRAINT "locale_strings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_settings" ADD CONSTRAINT "super_admin_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
