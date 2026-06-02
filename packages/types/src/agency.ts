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

export const AGENCY_CONTACT_OPTIONS = ["Text", "Phone", "Email", "Link", "Portal", "App"] as const;

export const AgencySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  primary_contact: ContactSchema.nullable(),
  notes: z.string().nullable(),
  contact_method: z.string().nullable(),
  telephone: z.string().nullable(),
  id_number: z.string().nullable(),
  rate_qualified: z.number().nullable(),
  rate_certified: z.number().nullable(),
  rate_qme: z.number().nullable(),
  miles: z.number().nullable(),
  reporting_info: z.string().nullable(),
  followup_info: z.string().nullable(),
  invoice_info: z.string().nullable(),
  email_intake: EmailIntakeConfigSchema.nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateAgencyBodySchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).nullish(),
  phone: z.string().max(20).nullish(),
  primary_contact: ContactSchema.nullish(),
  notes: z.string().max(5000).nullish(),
  contact_method: z.string().max(255).nullish(),
  telephone: z.string().max(20).nullish(),
  id_number: z.string().max(100).nullish(),
  rate_qualified: z.number().nonnegative().nullish(),
  rate_certified: z.number().nonnegative().nullish(),
  rate_qme: z.number().nonnegative().nullish(),
  miles: z.number().nonnegative().nullish(),
  reporting_info: z.string().max(50).nullish(),
  followup_info: z.string().max(50).nullish(),
  invoice_info: z.string().max(50).nullish(),
  email_intake: EmailIntakeConfigSchema.optional(),
});

export const UpdateAgencyBodySchema = CreateAgencyBodySchema.partial();

export const AgencyListQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export type EmailIntakeConfig = z.infer<typeof EmailIntakeConfigSchema>;
export type Agency = z.infer<typeof AgencySchema>;
export type CreateAgencyBody = z.infer<typeof CreateAgencyBodySchema>;
export type UpdateAgencyBody = z.infer<typeof UpdateAgencyBodySchema>;
export type AgencyListQuery = z.infer<typeof AgencyListQuerySchema>;
