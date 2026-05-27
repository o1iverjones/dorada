import { z } from "zod";
import { UuidSchema } from "./common.js";

export const PatientSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  date_of_birth: z.string().nullable(),
  case_numbers: z.array(z.string()),
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
  case_numbers: z.array(z.string().min(1).max(100)).optional(),
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

export type Patient = z.infer<typeof PatientSchema>;
export type CreatePatientBody = z.infer<typeof CreatePatientBodySchema>;
export type UpdatePatientBody = z.infer<typeof UpdatePatientBodySchema>;
export type PatientListQuery = z.infer<typeof PatientListQuerySchema>;
