import { z } from "zod";
import { UuidSchema } from "./common.js";

export const FollowUpMediaSchema = z.object({
  id: UuidSchema,
  url: z.string().url(),
  type: z.string(),
  filename: z.string(),
  uploaded_at: z.string().datetime(),
});

export const FollowUpResponseSchema = z.object({
  id: UuidSchema,
  has_follow_up: z.boolean(),
  same_physician: z.boolean().nullable(),
  same_clinic: z.boolean().nullable(),
  follow_up_datetime: z.string().nullable(),
  notes: z.string().nullable(),
  media: z.array(FollowUpMediaSchema),
  draft_appointment_id: UuidSchema.nullable(),
  submitted_at: z.string().datetime(),
});

export const SubmitFollowUpBodySchema = z.object({
  has_follow_up: z.boolean(),
  same_physician: z.boolean().optional(),
  same_clinic: z.boolean().optional(),
  follow_up_datetime: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
});

export const FollowUpDraftSchema = z.object({
  id: UuidSchema,
  status: z.enum(["pending_review", "scheduled", "dismissed"]),
  created_from_appointment: z.object({ id: UuidSchema, date_time: z.string().datetime() }),
  patient: z.object({ id: UuidSchema, name: z.string() }),
  clinic: z.object({ id: UuidSchema, name: z.string() }).nullable(),
  interpreter: z.object({ id: UuidSchema, name: z.string() }),
  follow_up_response: z.object({
    same_physician: z.boolean().nullable(),
    same_clinic: z.boolean().nullable(),
    follow_up_datetime: z.string().nullable(),
    notes: z.string().nullable(),
    media: z.array(FollowUpMediaSchema),
  }),
  created_at: z.string().datetime(),
});

export const ReviewFollowUpDraftBodySchema = z.object({
  status: z.enum(["scheduled", "dismissed"]),
  date_time: z.string().datetime().optional(),
  clinic_id: UuidSchema.optional(),
  insurance_agency_id: UuidSchema.optional(),
  pre_auth_amount: z.number().nonnegative().optional(),
  pre_auth_mileage: z.number().int().nonnegative().optional(),
  notes: z.string().max(5000).optional(),
});

export type FollowUpMedia = z.infer<typeof FollowUpMediaSchema>;
export type FollowUpResponse = z.infer<typeof FollowUpResponseSchema>;
export type SubmitFollowUpBody = z.infer<typeof SubmitFollowUpBodySchema>;
export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;
export type ReviewFollowUpDraftBody = z.infer<typeof ReviewFollowUpDraftBodySchema>;
