import { z } from "zod";
import { ReportFormatSchema, ReportStatusSchema, ReportTypeSchema, UuidSchema } from "./common.js";

export const ReportFiltersSchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  interpreter_ids: z.array(UuidSchema).optional(),
  agency_ids: z.array(UuidSchema).optional(),
  clinic_ids: z.array(UuidSchema).optional(),
  statuses: z.array(z.string()).optional(),
  language: z.string().optional(),
  type_id: UuidSchema.optional(),
});

export const ReportOptionsSchema = z.object({
  detail_level: z.enum(["summary", "detail_and_summary", "detail_summary_by_clinic", "detail"]).optional(),
});

export const GenerateReportBodySchema = z.object({
  type: ReportTypeSchema,
  format: ReportFormatSchema,
  locale: z.string().min(2).max(10).optional(),
  filters: ReportFiltersSchema,
  options: ReportOptionsSchema.optional(),
});

export const ReportJobSchema = z.object({
  job_id: UuidSchema,
  status: ReportStatusSchema,
  type: ReportTypeSchema.optional(),
  format: ReportFormatSchema.optional(),
  download_url: z.string().url().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  estimated_seconds: z.number().int().optional(),
  error: z.string().nullable().optional(),
  created_at: z.string().datetime().optional(),
});

export const ReportListQuerySchema = z.object({
  type: ReportTypeSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ReportFilters = z.infer<typeof ReportFiltersSchema>;
export type ReportOptions = z.infer<typeof ReportOptionsSchema>;
export type GenerateReportBody = z.infer<typeof GenerateReportBodySchema>;
export type ReportJob = z.infer<typeof ReportJobSchema>;
export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;
