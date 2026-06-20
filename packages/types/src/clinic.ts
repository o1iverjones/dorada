import { z } from "zod";
import { BillingModelSchema, InvoiceCycleSchema, UuidSchema } from "./common.js";

export const ContactSchema = z.object({
  name: z.string().max(255),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

export const ClinicBillingSchema = z.object({
  model: BillingModelSchema,
  hourly_rate: z.number().nonnegative().nullable(),
  flat_rate: z.number().nonnegative().nullable(),
  invoice_cycle: InvoiceCycleSchema,
});

export const ClinicSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip_code: z.string().nullable(),
  parking: z.string().nullable(),
  phone: z.string().nullable(),
  primary_contact: ContactSchema.nullable(),
  billing: ClinicBillingSchema,
  is_active: z.boolean(),
  confirmation_emails_enabled: z.boolean().optional(),
  summary_emails_enabled: z.boolean().optional(),
  summary_email_days: z.array(z.number().int().min(0).max(6)).optional(),
  interpreters_not_allowed: z.array(z.object({ id: UuidSchema, name: z.string() })).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateClinicBodySchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip_code: z.string().max(20).optional(),
  parking: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  primary_contact: ContactSchema.optional(),
  billing: ClinicBillingSchema,
  confirmation_emails_enabled: z.boolean().optional(),
  summary_emails_enabled: z.boolean().optional(),
  summary_email_days: z.array(z.number().int().min(0).max(6)).optional(),
});

export const UpdateClinicBodySchema = CreateClinicBodySchema.partial().extend({
  is_active: z.boolean().optional(),
  confirmation_emails_enabled: z.boolean().optional(),
  summary_emails_enabled: z.boolean().optional(),
  summary_email_days: z.array(z.number().int().min(0).max(6)).optional(),
});

export const ClinicListQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export const ClinicInterpreterNoteTypeSchema = z.enum(["important", "notice", "info"]);

export const ClinicInterpreterNoteSchema = z.object({
  id: UuidSchema,
  clinic_id: UuidSchema,
  content: z.string(),
  type: ClinicInterpreterNoteTypeSchema,
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateClinicInterpreterNoteBodySchema = z.object({
  content: z.string().min(1).max(1000),
  type: ClinicInterpreterNoteTypeSchema.default("notice"),
});

export const UpdateClinicInterpreterNoteBodySchema = z.object({
  content: z.string().min(1).max(1000).optional(),
  type: ClinicInterpreterNoteTypeSchema.optional(),
  is_active: z.boolean().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;
export type ClinicBilling = z.infer<typeof ClinicBillingSchema>;
export type Clinic = z.infer<typeof ClinicSchema>;
export type CreateClinicBody = z.infer<typeof CreateClinicBodySchema>;
export type UpdateClinicBody = z.infer<typeof UpdateClinicBodySchema>;
export type ClinicListQuery = z.infer<typeof ClinicListQuerySchema>;
export type ClinicInterpreterNoteType = z.infer<typeof ClinicInterpreterNoteTypeSchema>;
export type ClinicInterpreterNote = z.infer<typeof ClinicInterpreterNoteSchema>;
export type CreateClinicInterpreterNoteBody = z.infer<typeof CreateClinicInterpreterNoteBodySchema>;
export type UpdateClinicInterpreterNoteBody = z.infer<typeof UpdateClinicInterpreterNoteBodySchema>;
