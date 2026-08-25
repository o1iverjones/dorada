-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_interpreter_id_idx" ON "refresh_tokens"("interpreter_id");

-- CreateIndex
CREATE INDEX "interpreter_notes_interpreter_id_idx" ON "interpreter_notes"("interpreter_id");

-- CreateIndex
CREATE INDEX "interpreter_availability_interpreter_id_idx" ON "interpreter_availability"("interpreter_id");

-- CreateIndex
CREATE INDEX "clinics_organization_id_name_idx" ON "clinics"("organization_id", "name");

-- CreateIndex
CREATE INDEX "clinic_doctors_clinic_id_idx" ON "clinic_doctors"("clinic_id");

-- CreateIndex
CREATE INDEX "agencies_organization_id_name_idx" ON "agencies"("organization_id", "name");

-- CreateIndex
CREATE INDEX "patients_organization_id_name_idx" ON "patients"("organization_id", "name");

-- CreateIndex
CREATE INDEX "claims_patient_id_idx" ON "claims"("patient_id");

-- CreateIndex
CREATE INDEX "claims_organization_id_case_number_idx" ON "claims"("organization_id", "case_number");

-- CreateIndex
CREATE INDEX "insurance_companies_organization_id_name_idx" ON "insurance_companies"("organization_id", "name");

-- CreateIndex
CREATE INDEX "insurance_company_notes_insurance_company_id_idx" ON "insurance_company_notes"("insurance_company_id");

-- CreateIndex
CREATE INDEX "patient_notes_patient_id_idx" ON "patient_notes"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_organization_id_date_time_idx" ON "appointments"("organization_id", "date_time");

-- CreateIndex
CREATE INDEX "appointments_organization_id_status_idx" ON "appointments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "appointments_interpreter_id_date_time_idx" ON "appointments"("interpreter_id", "date_time");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_idx" ON "appointments"("clinic_id");

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_agency_id_idx" ON "appointments"("agency_id");

-- CreateIndex
CREATE INDEX "appointments_type_id_idx" ON "appointments"("type_id");

-- CreateIndex
CREATE INDEX "appointment_media_appointment_id_idx" ON "appointment_media"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_activities_appointment_id_created_at_idx" ON "appointment_activities"("appointment_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_organization_id_entity_type_entity_id_created_idx" ON "activity_logs"("organization_id", "entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "appointment_notes_appointment_id_idx" ON "appointment_notes"("appointment_id");

-- CreateIndex
CREATE INDEX "clinic_notes_clinic_id_idx" ON "clinic_notes"("clinic_id");

-- CreateIndex
CREATE INDEX "agency_notes_agency_id_idx" ON "agency_notes"("agency_id");

-- CreateIndex
CREATE INDEX "clinic_interpreter_notes_clinic_id_idx" ON "clinic_interpreter_notes"("clinic_id");

-- CreateIndex
CREATE INDEX "appointment_offers_interpreter_id_status_idx" ON "appointment_offers"("interpreter_id", "status");

-- CreateIndex
CREATE INDEX "follow_up_media_follow_up_response_id_idx" ON "follow_up_media"("follow_up_response_id");

-- CreateIndex
CREATE INDEX "email_intake_logs_organization_id_created_at_idx" ON "email_intake_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "report_jobs_organization_id_created_at_idx" ON "report_jobs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_interpreter_id_sent_at_idx" ON "messages"("interpreter_id", "sent_at");

-- CreateIndex
CREATE INDEX "messages_organization_id_sent_at_idx" ON "messages"("organization_id", "sent_at");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_interpreter_id_idx" ON "invoices"("interpreter_id");

