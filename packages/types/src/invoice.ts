import { z } from "zod";
import { UuidSchema } from "./common.js";

export const InvoiceSchema = z.object({
  id: UuidSchema,
  organization_id: UuidSchema,
  appointment_id: UuidSchema,
  interpreter_id: UuidSchema,
  status: z.enum(["submitted", "approved"]),
  amount: z.coerce.number(),
  billable_minutes: z.number().int(),
  pay_rate: z.coerce.number(),
  submitted_at: z.string().datetime(),
  approved_at: z.string().datetime().nullable(),
  approved_by_id: UuidSchema.nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  appointment: z.object({
    id: UuidSchema,
    date_time: z.string().datetime(),
    duration_minutes: z.number().int(),
    po_number: z.string().nullable(),
    patient: z.object({ id: UuidSchema, name: z.string() }),
    clinic: z.object({ id: UuidSchema, name: z.string() }),
  }).optional(),
  interpreter: z.object({ id: UuidSchema, name: z.string() }).optional(),
  approved_by: z.object({ id: UuidSchema, name: z.string() }).nullable().optional(),
});

export const InvoiceListQuerySchema = z.object({
  status: z.string().optional(),
  interpreter_id: UuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ApproveInvoiceBodySchema = z.object({
  notes: z.string().max(2000).optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;
export type ApproveInvoiceBody = z.infer<typeof ApproveInvoiceBodySchema>;
