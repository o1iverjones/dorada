import { z } from "zod";
import { AppointmentStatusSchema, InterpreterTypeSchema, UuidSchema } from "./common.js";

export const AppointmentTypeSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  pay_model: z.enum(["hourly", "flat"]),
  minimum_billable_minutes: z.number().int().positive(),
});

export const AppointmentOfferSchema = z.object({
  id: UuidSchema,
  interpreter: z.object({ id: UuidSchema, name: z.string() }),
  status: z.enum(["pending", "confirmed", "declined", "expired"]),
  offered_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
});

export const AppointmentSchema = z.object({
  id: UuidSchema,
  status: AppointmentStatusSchema,
  date_time: z.string().datetime(),
  duration_minutes: z.number().int().positive(),
  type: z.object({ id: UuidSchema, name: z.string() }),
  language: z.string(),
  interpreter_type_required: InterpreterTypeSchema,
  interpreter: z.object({ id: UuidSchema, name: z.string() }).nullable(),
  clinic: z.object({ id: UuidSchema, name: z.string(), address: z.string().nullable().optional(), parking: z.string().nullable().optional() }),
  agency: z.object({ id: UuidSchema, name: z.string() }),
  patient: z.object({ id: UuidSchema, name: z.string(), mrn: z.string(), date_of_birth: z.string().nullable().optional() }),
  referring_physician: z.string().nullable(),
  department: z.string().nullable(),
  pre_auth_amount: z.number().nonnegative(),
  pre_auth_mileage: z.number().int().nonnegative(),
  po_number: z.string().nullable(),
  billing_interpreter: z.string().nullable(),
  source: z.enum(["manual", "email_intake", "follow_up"]),
  clock_in: z.string().datetime().nullable(),
  clock_out: z.string().datetime().nullable(),
  shift_notes: z.string().nullable().optional(),
  offers: z.array(AppointmentOfferSchema).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateAppointmentBodySchema = z.object({
  date_time: z.string().datetime(),
  duration_minutes: z.number().int().positive(),
  type_id: UuidSchema,
  language: z.string().min(1).max(50),
  interpreter_type_required: InterpreterTypeSchema,
  clinic_id: UuidSchema,
  agency_id: UuidSchema,
  patient_id: UuidSchema,
  referring_physician: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  pre_auth_amount: z.coerce.number().nonnegative(),
  pre_auth_mileage: z.coerce.number().int().nonnegative(),
  po_number: z.string().max(100).optional(),
  billing_interpreter: z.string().max(255).nullish(),
});

export const UpdateAppointmentBodySchema = CreateAppointmentBodySchema.partial().extend({
  status: AppointmentStatusSchema.optional(),
});

export const OfferAppointmentBodySchema = z.object({
  interpreter_ids: z.array(UuidSchema).min(1).max(20),
  expires_after_minutes: z.number().int().positive().default(60),
});

export const ClockOutResponseSchema = z.object({
  clock_out: z.string().datetime(),
  actual_duration_minutes: z.number().int(),
  billable_duration_minutes: z.number().int(),
  status: AppointmentStatusSchema,
});

export const ShiftNotesBodySchema = z.object({
  notes: z.string().max(5000),
});

export const AppointmentListQuerySchema = z.object({
  status: z.string().optional(),
  interpreter_id: UuidSchema.optional(),
  clinic_id: UuidSchema.optional(),
  agency_id: UuidSchema.optional(),
  language: z.string().optional(),
  type_id: UuidSchema.optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export type AppointmentType = z.infer<typeof AppointmentTypeSchema>;
export type AppointmentOffer = z.infer<typeof AppointmentOfferSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type CreateAppointmentBody = z.infer<typeof CreateAppointmentBodySchema>;
export type UpdateAppointmentBody = z.infer<typeof UpdateAppointmentBodySchema>;
export type OfferAppointmentBody = z.infer<typeof OfferAppointmentBodySchema>;
export type ClockOutResponse = z.infer<typeof ClockOutResponseSchema>;
export type ShiftNotesBody = z.infer<typeof ShiftNotesBodySchema>;
export type AppointmentListQuery = z.infer<typeof AppointmentListQuerySchema>;
