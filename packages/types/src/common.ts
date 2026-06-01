import { z } from "zod";

export const UuidSchema = z.string().uuid();

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const PaginationResponseSchema = z.object({
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const AppointmentStatusSchema = z.enum([
  "pending_offer",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "declined",
]);

export const InterpreterTypeSchema = z.enum(["certified", "qualified"]);

export const PayModelSchema = z.enum(["hourly", "flat", "flat_rate"]);

export const BillingModelSchema = z.enum(["hourly", "flat", "mixed", "monthly"]);

export const InvoiceCycleSchema = z.enum(["monthly", "weekly", "per_appointment"]);

export const NotificationChannelSchema = z.enum(["push", "sms"]);

export const ReportTypeSchema = z.enum([
  "interpreter_compensation",
  "insurance_agency_billing",
  "appointment_history",
  "interpreter_performance",
]);

export const ReportFormatSchema = z.enum(["pdf", "csv"]);

export const ReportStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);

export const EmailIntakeStatusSchema = z.enum([
  "pending",
  "processing",
  "draft_created",
  "failed",
  "duplicate_po",
  "flagged",
]);

export const ConfirmationMethodSchema = z.enum(["reply_email", "confirmation_link"]);

export const DraftStatusSchema = z.enum(["pending_review", "approved", "dismissed", "scheduled"]);

export const PermissionSchema = z.enum([
  "manage_interpreters",
  "manage_clinics",
  "manage_admin_users",
  "view_reports",
  "manage_appointments",
  "manage_system_settings",
  "manage_invoices",
]);

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;
export type InterpreterType = z.infer<typeof InterpreterTypeSchema>;
export type PayModel = z.infer<typeof PayModelSchema>;
export type BillingModel = z.infer<typeof BillingModelSchema>;
export type InvoiceCycle = z.infer<typeof InvoiceCycleSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type ReportType = z.infer<typeof ReportTypeSchema>;
export type ReportFormat = z.infer<typeof ReportFormatSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type EmailIntakeStatus = z.infer<typeof EmailIntakeStatusSchema>;
export type ConfirmationMethod = z.infer<typeof ConfirmationMethodSchema>;
export type DraftStatus = z.infer<typeof DraftStatusSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
