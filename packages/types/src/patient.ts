import { z } from "zod";
import { UuidSchema } from "./common.js";

// ─── Claim ────────────────────────────────────────────────────────────────────

export const ClaimSchema = z.object({
  id: UuidSchema,
  patient_id: UuidSchema,
  case_number: z.string(),
  injury: z.string().nullable(),
  date_of_injury: z.string().nullable(),
  agency: z.object({ id: UuidSchema, name: z.string() }).nullable().optional(),
  insurance_company: z.object({ id: UuidSchema, name: z.string() }).nullable().optional(),
  adjuster: z.string().nullable(),
  adjuster_phone: z.string().nullable(),
  adjuster_email: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateClaimBodySchema = z.object({
  case_number: z.string().min(1).max(100),
  injury: z.string().max(255).nullish(),
  date_of_injury: z.string().date().nullish(),
  agency_id: UuidSchema.nullish(),
  insurance_company_id: UuidSchema.nullish(),
  adjuster: z.string().max(255).nullish(),
  adjuster_phone: z.string().max(30).nullish(),
  adjuster_email: z.string().email().max(255).nullish(),
});

export const UpdateClaimBodySchema = CreateClaimBodySchema.partial();

// ─── Patient ──────────────────────────────────────────────────────────────────

export const PatientSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  date_of_birth: z.string().nullable(),
  claims: z.array(ClaimSchema),
  preferred_interpreter: z.object({ id: UuidSchema, name: z.string() }).nullable().optional(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  preferred_language: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreatePatientBodySchema = z.object({
  name: z.string().min(1).max(255),
  date_of_birth: z.string().date().optional(),
  preferred_interpreter_id: UuidSchema.nullable().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  preferred_language: z.string().min(2).max(10).optional(),
});

export const UpdatePatientBodySchema = CreatePatientBodySchema.partial().extend({
  // Allow null to clear the date of birth
  date_of_birth: z.string().date().nullable().optional(),
  preferred_interpreter_id: UuidSchema.nullable().optional(),
});

export const PatientListQuerySchema = z.object({
  search: z.string().optional(),
  language: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export type Claim = z.infer<typeof ClaimSchema>;
export type CreateClaimBody = z.infer<typeof CreateClaimBodySchema>;
export type UpdateClaimBody = z.infer<typeof UpdateClaimBodySchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type CreatePatientBody = z.infer<typeof CreatePatientBodySchema>;
export type UpdatePatientBody = z.infer<typeof UpdatePatientBodySchema>;
export type PatientListQuery = z.infer<typeof PatientListQuerySchema>;
