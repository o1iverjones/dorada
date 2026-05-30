import { z } from "zod";
import { UuidSchema } from "./common.js";

export const InsuranceCompanySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
  fax: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip_code: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateInsuranceCompanyBodySchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(20).nullish(),
  fax: z.string().max(20).nullish(),
  email: z.string().email().max(255).nullish(),
  address: z.string().max(500).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(100).nullish(),
  zip_code: z.string().max(20).nullish(),
});

export const UpdateInsuranceCompanyBodySchema = CreateInsuranceCompanyBodySchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const InsuranceCompanyListQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export type InsuranceCompany = z.infer<typeof InsuranceCompanySchema>;
export type CreateInsuranceCompanyBody = z.infer<typeof CreateInsuranceCompanyBodySchema>;
export type UpdateInsuranceCompanyBody = z.infer<typeof UpdateInsuranceCompanyBodySchema>;
export type InsuranceCompanyListQuery = z.infer<typeof InsuranceCompanyListQuerySchema>;
