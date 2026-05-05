import { z } from "zod";
import { ConfirmationMethodSchema, UuidSchema } from "./common.js";
import { ContactSchema } from "./clinic.js";

export const EmailIntakeConfigSchema = z.object({
  sender_domains: z.array(z.string()).min(1),
  confirmation_method_override: ConfirmationMethodSchema.nullable(),
  reply_template: z.string().max(5000),
  reply_from_name: z.string().max(255),
  reply_from_email: z.string().email(),
});

export const InsuranceAgencySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  primary_contact: ContactSchema.nullable(),
  notes: z.string().nullable(),
  email_intake: EmailIntakeConfigSchema.nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateInsuranceAgencyBodySchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  primary_contact: ContactSchema.optional(),
  notes: z.string().max(5000).optional(),
  email_intake: EmailIntakeConfigSchema.optional(),
});

export const UpdateInsuranceAgencyBodySchema = CreateInsuranceAgencyBodySchema.partial();

export const InsuranceAgencyListQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type EmailIntakeConfig = z.infer<typeof EmailIntakeConfigSchema>;
export type InsuranceAgency = z.infer<typeof InsuranceAgencySchema>;
export type CreateInsuranceAgencyBody = z.infer<typeof CreateInsuranceAgencyBodySchema>;
export type UpdateInsuranceAgencyBody = z.infer<typeof UpdateInsuranceAgencyBodySchema>;
export type InsuranceAgencyListQuery = z.infer<typeof InsuranceAgencyListQuerySchema>;
