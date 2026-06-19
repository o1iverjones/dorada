import { z } from "zod";
import { PayModelSchema, UuidSchema } from "./common.js";

export const LanguageSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string(),
  active: z.boolean(),
});

export const AppointmentTypeSettingSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  pay_model: PayModelSchema,
  minimum_billable_minutes: z.number().int().positive(),
  is_active: z.boolean(),
});

export const SystemSettingsSchema = z.object({
  default_pay_rates: z.object({
    certified: z.number().nonnegative(),
    qualified: z.number().nonnegative(),
  }),
  offer_expiry_default_minutes: z.number().int().positive(),
  follow_up_config: z.object({
    non_response_window_minutes: z.number().int().positive(),
    max_reminders: z.number().int().nonnegative(),
  }),
  languages: z.array(LanguageSchema),
  appointment_types: z.array(AppointmentTypeSettingSchema),
  allow_manual_confirm: z.boolean(),
  show_language: z.boolean(),
  long_appointment_alert_minutes: z.number().int().positive(),
  clinic_confirmation_enabled: z.boolean(),
  clinic_confirmation_time: z.string(),
  clinic_summary_emails_enabled: z.boolean(),
});

export const UpdateSystemSettingsBodySchema = z.object({
  default_pay_rates: z.object({
    certified: z.number().nonnegative(),
    qualified: z.number().nonnegative(),
  }).optional(),
  offer_expiry_default_minutes: z.number().int().positive().optional(),
  follow_up_config: z.object({
    non_response_window_minutes: z.number().int().positive(),
    max_reminders: z.number().int().nonnegative(),
  }).optional(),
  timezone: z.string().optional(),
  allow_manual_confirm: z.boolean().optional(),
  show_language: z.boolean().optional(),
  long_appointment_alert_minutes: z.number().int().positive().optional(),
  clinic_confirmation_enabled: z.boolean().optional(),
  clinic_confirmation_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  clinic_summary_emails_enabled: z.boolean().optional(),
});

export const CreateAppointmentTypeBodySchema = z.object({
  name: z.string().min(1).max(100),
  pay_model: PayModelSchema,
  minimum_billable_minutes: z.number().int().positive(),
});

export const UpdateAppointmentTypeBodySchema = CreateAppointmentTypeBodySchema.partial();

export const UpdateLanguageListBodySchema = z.object({
  languages: z.array(LanguageSchema).min(1),
});

export const UpdateLocalizationStringsBodySchema = z.object({
  strings: z.record(z.string(), z.string()),
});

export const SuperAdminSettingsSchema = z.object({
  email_polling_interval_minutes: z.number().int().positive(),
  llm_model: z.string(),
  llm_prompt_version: z.string(),
  max_confirmation_retries: z.number().int().nonnegative(),
  playwright_timeout_seconds: z.number().int().positive(),
});

export type Language = z.infer<typeof LanguageSchema>;
export type AppointmentTypeSetting = z.infer<typeof AppointmentTypeSettingSchema>;
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
export type UpdateSystemSettingsBody = z.infer<typeof UpdateSystemSettingsBodySchema>;
export type CreateAppointmentTypeBody = z.infer<typeof CreateAppointmentTypeBodySchema>;
export type UpdateAppointmentTypeBody = z.infer<typeof UpdateAppointmentTypeBodySchema>;
export type UpdateLanguageListBody = z.infer<typeof UpdateLanguageListBodySchema>;
export type UpdateLocalizationStringsBody = z.infer<typeof UpdateLocalizationStringsBodySchema>;
export type SuperAdminSettings = z.infer<typeof SuperAdminSettingsSchema>;

export const AdminAlertSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  type: z.enum(["offer_declined", "long_appointment", "stale_billing"]),
  appointment_id: z.string().nullable(),
  message: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
});

export type AdminAlert = z.infer<typeof AdminAlertSchema>;
