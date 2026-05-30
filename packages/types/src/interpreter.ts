import { z } from "zod";
import { InterpreterTypeSchema, NotificationChannelSchema, UuidSchema } from "./common.js";

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const AvailabilityBlockSchema = z.object({
  id: UuidSchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
  reason: z.string().nullable(),
});

export const EmergencyContactSchema = z.object({
  name: z.string().max(255),
  phone: z.string().max(20),
});

export const InterpreterSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  type: InterpreterTypeSchema,
  languages: z.array(z.string()),
  profile_picture_url: z.string().url().nullable(),
  location: LocationSchema.nullable(),
  pay_rate: z.number().nonnegative().nullable(),
  payment_method: z.string().nullable(),
  clinics_not_allowed: z.array(z.object({ id: UuidSchema, name: z.string() })),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  emergency_contact: EmergencyContactSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  certificate_number: z.string().nullable().optional(),
  zip_code: z.string().nullable().optional(),
  coverage_range_miles: z.number().nonnegative().nullable().optional(),
  availability_blocks: z.array(AvailabilityBlockSchema).optional(),
});

export const CreateInterpreterBodySchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(7).max(20),
  email: z.string().email().nullish(),
  type: InterpreterTypeSchema,
  languages: z.array(z.string().min(2).max(10)).min(1),
  location: LocationSchema.optional(),
  pay_rate: z.number().nonnegative().nullish(),
  payment_method: z.string().max(100).nullish(),
  address_line1: z.string().max(500).nullish(),
  address_line2: z.string().max(500).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(100).nullish(),
  emergency_contact: EmergencyContactSchema.optional(),
  clinics_not_allowed: z.array(UuidSchema).optional(),
  notes: z.string().max(5000).nullish(),
  certificate_number: z.string().max(100).nullish(),
  zip_code: z.string().max(10).nullish(),
  coverage_range_miles: z.number().nonnegative().nullish(),
});

export const UpdateInterpreterBodySchema = CreateInterpreterBodySchema.partial();

export const UpdateSelfInterpreterBodySchema = z.object({
  email: z.string().email().optional(),
  location: LocationSchema.optional(),
  fcm_token: z.string().max(512).optional(),
});

export const CreateAvailabilityBlockBodySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

export const InterpreterListQuerySchema = z.object({
  type: InterpreterTypeSchema.optional(),
  language: z.string().optional(),
  clinic_id: UuidSchema.optional(),
  available_on: z.string().datetime().optional(),
  check_availability_on: z.string().datetime().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const InterpreterPreferencesSchema = z.object({
  notification_channel: NotificationChannelSchema,
});

export type Location = z.infer<typeof LocationSchema>;
export type AvailabilityBlock = z.infer<typeof AvailabilityBlockSchema>;
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;
export type Interpreter = z.infer<typeof InterpreterSchema>;
export type CreateInterpreterBody = z.infer<typeof CreateInterpreterBodySchema>;
export type UpdateInterpreterBody = z.infer<typeof UpdateInterpreterBodySchema>;
export type UpdateSelfInterpreterBody = z.infer<typeof UpdateSelfInterpreterBodySchema>;
export type CreateAvailabilityBlockBody = z.infer<typeof CreateAvailabilityBlockBodySchema>;
export type InterpreterListQuery = z.infer<typeof InterpreterListQuerySchema>;
export type InterpreterPreferences = z.infer<typeof InterpreterPreferencesSchema>;
