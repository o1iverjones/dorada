import { z } from "zod";
import { ConfidenceLevelSchema, ConfirmationMethodSchema, EmailIntakeStatusSchema, UuidSchema } from "./common.js";

export const ExtractionFieldSchema = z.object({
  value: z.unknown(),
  confidence: ConfidenceLevelSchema,
  matched_record_id: UuidSchema.nullable().optional(),
  auto_created: z.boolean().optional(),
});

export const ExtractionResultSchema = z.object({
  model: z.string(),
  prompt_version: z.string(),
  extracted_at: z.string().datetime(),
  fields: z.object({
    patient_name: ExtractionFieldSchema,
    po_number: ExtractionFieldSchema,
    date_time: ExtractionFieldSchema,
    doctor_name: ExtractionFieldSchema,
    clinic_name: ExtractionFieldSchema,
    languages: ExtractionFieldSchema,
    confirmation_method: ExtractionFieldSchema,
  }),
  unresolved_fields: z.array(z.string()),
});

export const EmailIntakeLogSchema = z.object({
  id: UuidSchema,
  received_at: z.string().datetime(),
  from_email: z.string().email(),
  subject: z.string(),
  status: EmailIntakeStatusSchema,
  agency: z.object({ id: UuidSchema, name: z.string() }).nullable(),
  draft_appointment_id: UuidSchema.nullable(),
  confirmation_status: z.enum(["pending", "success", "failed"]).nullable(),
  confirmation_method: ConfirmationMethodSchema.nullable(),
  has_unresolved_fields: z.boolean(),
  duplicate_po: z.boolean(),
  processed_at: z.string().datetime().nullable(),
  raw_email_url: z.string().url().optional(),
  extraction: ExtractionResultSchema.optional(),
  confirmation: z.object({
    method: ConfirmationMethodSchema,
    status: z.enum(["pending", "success", "failed"]),
    executed_at: z.string().datetime().nullable(),
    screenshot_url: z.string().url().nullable(),
  }).optional(),
});

export const EmailIntakeDraftSchema = z.object({
  id: UuidSchema,
  status: z.enum(["pending_review", "approved", "dismissed"]),
  has_unresolved_fields: z.boolean(),
  po_number: z.string().nullable(),
  date_time: z.string().datetime().nullable(),
  patient: z.object({ id: UuidSchema, name: z.string(), ai_generated: z.boolean() }).nullable(),
  clinic: z.object({ id: UuidSchema, name: z.string(), ai_generated: z.boolean() }).nullable(),
  agency: z.object({ id: UuidSchema, name: z.string() }).nullable(),
  languages: z.array(z.string()),
  referring_physician: z.string().nullable(),
  unresolved_fields: z.array(z.string()),
  email_log_id: UuidSchema,
  created_at: z.string().datetime(),
});

export const ReviewEmailIntakeDraftBodySchema = z.object({
  status: z.enum(["approved", "dismissed"]),
  date_time: z.string().datetime().optional(),
  patient_id: UuidSchema.optional(),
  clinic_id: UuidSchema.optional(),
  agency_id: UuidSchema.optional(),
  type_id: UuidSchema.optional(),
  languages: z.array(z.string()).optional(),
  interpreter_type_required: z.enum(["certified", "qualified"]).optional(),
  referring_physician: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  pre_auth_amount: z.number().nonnegative().optional(),
  pre_auth_mileage: z.number().int().nonnegative().optional(),
});

export const EmailIntakeLogListQuerySchema = z.object({
  status: z.string().optional(),
  agency_id: UuidSchema.optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const EmailIntakeDraftListQuerySchema = z.object({
  status: z.string().optional(),
  has_unresolved_fields: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ExtractionField = z.infer<typeof ExtractionFieldSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type EmailIntakeLog = z.infer<typeof EmailIntakeLogSchema>;
export type EmailIntakeDraft = z.infer<typeof EmailIntakeDraftSchema>;
export type ReviewEmailIntakeDraftBody = z.infer<typeof ReviewEmailIntakeDraftBodySchema>;
export type EmailIntakeLogListQuery = z.infer<typeof EmailIntakeLogListQuerySchema>;
export type EmailIntakeDraftListQuery = z.infer<typeof EmailIntakeDraftListQuerySchema>;
