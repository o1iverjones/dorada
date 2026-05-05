import { z } from "zod";
import { UuidSchema } from "./common.js";

export const PatientSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  mrn: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  preferred_language: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreatePatientBodySchema = z.object({
  name: z.string().min(1).max(255),
  mrn: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  preferred_language: z.string().min(2).max(10).optional(),
});

export const UpdatePatientBodySchema = CreatePatientBodySchema.partial();

export const PatientListQuerySchema = z.object({
  search: z.string().optional(),
  language: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type Patient = z.infer<typeof PatientSchema>;
export type CreatePatientBody = z.infer<typeof CreatePatientBodySchema>;
export type UpdatePatientBody = z.infer<typeof UpdatePatientBodySchema>;
export type PatientListQuery = z.infer<typeof PatientListQuerySchema>;
