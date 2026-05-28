import { z } from "zod";
import { UuidSchema } from "./common.js";

export const InsuranceCompanySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateInsuranceCompanyBodySchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
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
