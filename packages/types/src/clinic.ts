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
  phone: z.string().nullable(),
  primary_contact: ContactSchema.nullable(),
  billing: ClinicBillingSchema,
  is_active: z.boolean(),
  interpreters_not_allowed: z.array(z.object({ id: UuidSchema, name: z.string() })).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateClinicBodySchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  primary_contact: ContactSchema.optional(),
  billing: ClinicBillingSchema,
});

export const UpdateClinicBodySchema = CreateClinicBodySchema.partial();

export const ClinicListQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type Contact = z.infer<typeof ContactSchema>;
export type ClinicBilling = z.infer<typeof ClinicBillingSchema>;
export type Clinic = z.infer<typeof ClinicSchema>;
export type CreateClinicBody = z.infer<typeof CreateClinicBodySchema>;
export type UpdateClinicBody = z.infer<typeof UpdateClinicBodySchema>;
export type ClinicListQuery = z.infer<typeof ClinicListQuerySchema>;
