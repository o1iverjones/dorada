import type { PrismaClient } from "@prisma/client";
import type {
  CreateAppointmentBody,
  UpdateAppointmentBody,
  OfferAppointmentBody,
  ShiftNotesBody,
  SubmitFollowUpBody,
  ReviewFollowUpDraftBody,
  AppointmentListQuery,
} from "@pulpito/types";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
} from "../../lib/errors.js";
import { addMinutes, diffMinutes } from "@pulpito/utils";

function ensureTenant(record: { organization_id: string } | null, organizationId: string, code: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError(code, "Resource not found");
  }
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_offer: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

function assertValidTransition(from: string, to: string) {
  if (!STATUS_TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError("INVALID_STATUS_TRANSITION", `Cannot transition from ${from} to ${to}`);
  }
}

export async function listAppointments(query: AppointmentListQuery, organizationId: string, prisma: PrismaClient) {
  const statuses = query.status ? query.status.split(",") : undefined;
  const where = {
    organization_id: organizationId,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(query.interpreter_id ? { interpreter_id: query.interpreter_id } : {}),
    ...(query.clinic_id ? { clinic_id: query.clinic_id } : {}),
    ...(query.insurance_agency_id ? { insurance_agency_id: query.insurance_agency_id } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.type_id ? { type_id: query.type_id } : {}),
    ...(query.date_from || query.date_to
      ? {
          date_time: {
            ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
            ...(query.date_to ? { lte: new Date(query.date_to + "T23:59:59Z") } : {}),
          },
        }
      : {}),
    ...(query.cursor ? { id: { gt: query.cursor } } : {}),
  };

  const items = await prisma.appointment.findMany({
    where,
    take: query.limit + 1,
    orderBy: { date_time: "asc" },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      insurance_agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true, mrn: true } },
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data,
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function getAppointment(id: string, organizationId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      insurance_agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true, mrn: true } },
      offers: { include: { interpreter: { select: { id: true, name: true } } } },
    },
  });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  return appt;
}

export async function createAppointment(body: CreateAppointmentBody, organizationId: string, prisma: PrismaClient) {
  return prisma.appointment.create({
    data: {
      organization_id: organizationId,
      date_time: new Date(body.date_time),
      duration_minutes: body.duration_minutes,
      type_id: body.type_id,
      language: body.language,
      interpreter_type_required: body.interpreter_type_required,
      clinic_id: body.clinic_id,
      insurance_agency_id: body.insurance_agency_id,
      patient_id: body.patient_id,
      referring_physician: body.referring_physician ?? null,
      department: body.department ?? null,
      pre_auth_amount: body.pre_auth_amount,
      pre_auth_mileage: body.pre_auth_mileage,
      po_number: body.po_number ?? null,
      status: "pending_offer",
      source: "manual",
    },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      insurance_agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true, mrn: true } },
    },
  });
}

export async function updateAppointment(
  id: string,
  body: UpdateAppointmentBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");

  if (body.status) assertValidTransition(appt!.status, body.status);

  return prisma.appointment.update({
    where: { id },
    data: {
      ...(body.date_time ? { date_time: new Date(body.date_time) } : {}),
      ...(body.duration_minutes !== undefined ? { duration_minutes: body.duration_minutes } : {}),
      ...(body.type_id ? { type_id: body.type_id } : {}),
      ...(body.language ? { language: body.language } : {}),
      ...(body.interpreter_type_required ? { interpreter_type_required: body.interpreter_type_required } : {}),
      ...(body.clinic_id ? { clinic_id: body.clinic_id } : {}),
      ...(body.insurance_agency_id ? { insurance_agency_id: body.insurance_agency_id } : {}),
      ...(body.patient_id ? { patient_id: body.patient_id } : {}),
      ...(body.referring_physician !== undefined ? { referring_physician: body.referring_physician } : {}),
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.pre_auth_amount !== undefined ? { pre_auth_amount: body.pre_auth_amount } : {}),
      ...(body.pre_auth_mileage !== undefined ? { pre_auth_mileage: body.pre_auth_mileage } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      insurance_agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true, mrn: true } },
    },
  });
}

export async function cancelAppointment(id: string, organizationId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  assertValidTransition(appt!.status, "cancelled");

  await prisma.$transaction([
    prisma.appointment.update({ where: { id }, data: { status: "cancelled" } }),
    prisma.appointmentOffer.updateMany({
      where: { appointment_id: id, status: "pending" },
      data: { status: "expired" },
    }),
  ]);
}

export async function offerAppointment(
  id: string,
  body: OfferAppointmentBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");

  if (appt!.interpreter_id) throw new ConflictError("ALREADY_CONFIRMED", "Appointment already has an interpreter");

  const expiresAt = new Date(Date.now() + body.expires_after_minutes * 60_000);

  // Validate each interpreter
  const interpreters = await prisma.interpreter.findMany({
    where: { id: { in: body.interpreter_ids }, organization_id: organizationId, is_active: true },
    include: { clinics_not_allowed: true, availability_blocks: true },
  });

  const offers = [];
  for (const interpreter of interpreters) {
    if (interpreter.type !== appt!.interpreter_type_required) {
      throw new ValidationError("INTERPRETER_NOT_ELIGIBLE", `Interpreter ${interpreter.name} type mismatch`);
    }
    const blocked = interpreter.clinics_not_allowed.some((b) => b.clinic_id === appt!.clinic_id);
    if (blocked) {
      throw new ValidationError("INTERPRETER_NOT_ELIGIBLE", `Interpreter ${interpreter.name} is not allowed at this clinic`);
    }
    const hasConflict = interpreter.availability_blocks.some(
      (b) => new Date(b.from) <= new Date(appt!.date_time) && new Date(b.to) >= new Date(appt!.date_time),
    );
    if (hasConflict) {
      throw new ValidationError("INTERPRETER_UNAVAILABLE", `Interpreter ${interpreter.name} has an availability conflict`);
    }

    offers.push(
      prisma.appointmentOffer.create({
        data: {
          appointment_id: id,
          interpreter_id: interpreter.id,
          status: "pending",
          expires_at: expiresAt,
        },
        include: { interpreter: { select: { id: true, name: true } } },
      }),
    );
  }

  const created = await Promise.all(offers);
  return { offers: created };
}

export async function confirmOffer(
  appointmentId: string,
  offerId: string,
  interpreterId: string,
  prisma: PrismaClient,
) {
  const offer = await prisma.appointmentOffer.findUnique({
    where: { id: offerId },
    include: { appointment: true },
  });

  if (!offer || offer.appointment_id !== appointmentId || offer.interpreter_id !== interpreterId) {
    throw new NotFoundError("APPOINTMENT_NOT_FOUND", "Offer not found");
  }
  if (offer.status !== "pending") throw new ConflictError("OFFER_EXPIRED", "Offer is no longer pending");
  if (offer.expires_at && offer.expires_at < new Date()) {
    throw new ConflictError("OFFER_EXPIRED", "Offer has expired");
  }
  if (offer.appointment.interpreter_id) {
    throw new ConflictError("ALREADY_CONFIRMED", "Another interpreter already confirmed");
  }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { interpreter_id: interpreterId, status: "confirmed" },
    }),
    prisma.appointmentOffer.update({ where: { id: offerId }, data: { status: "confirmed", responded_at: new Date() } }),
    prisma.appointmentOffer.updateMany({
      where: { appointment_id: appointmentId, id: { not: offerId }, status: "pending" },
      data: { status: "expired" },
    }),
  ]);

  return { appointment: { id: appointmentId, status: "confirmed" } };
}

export async function declineOffer(
  appointmentId: string,
  offerId: string,
  interpreterId: string,
  prisma: PrismaClient,
) {
  const offer = await prisma.appointmentOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.appointment_id !== appointmentId || offer.interpreter_id !== interpreterId) {
    throw new NotFoundError("APPOINTMENT_NOT_FOUND", "Offer not found");
  }
  if (offer.status !== "pending") throw new ConflictError("OFFER_EXPIRED", "Offer is no longer pending");

  await prisma.appointmentOffer.update({
    where: { id: offerId },
    data: { status: "declined", responded_at: new Date() },
  });

  return { offer: { id: offerId, status: "declined" } };
}

export async function clockIn(appointmentId: string, interpreterId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "confirmed") throw new ValidationError("INVALID_STATUS_TRANSITION", "Appointment must be confirmed");
  if (appt.clock_in) throw new ConflictError("ALREADY_CLOCKED_IN", "Already clocked in");

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { clock_in: new Date(), status: "in_progress" },
  });

  return { clock_in: updated.clock_in!.toISOString(), status: "in_progress" };
}

export async function clockOut(appointmentId: string, interpreterId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { type: true } });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "in_progress") throw new ValidationError("INVALID_STATUS_TRANSITION", "Must be in progress");

  const now = new Date();
  const actualMinutes = appt.clock_in ? diffMinutes(appt.clock_in.toISOString(), now.toISOString()) : 0;
  const billableMinutes = Math.max(actualMinutes, appt.type.minimum_billable_minutes);

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { clock_out: now, status: "completed" },
  });

  return {
    clock_out: updated.clock_out!.toISOString(),
    actual_duration_minutes: actualMinutes,
    billable_duration_minutes: billableMinutes,
    status: "completed",
  };
}

export async function addShiftNotes(
  appointmentId: string,
  interpreterId: string,
  body: ShiftNotesBody,
  prisma: PrismaClient,
) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "completed") throw new ValidationError("INVALID_STATUS_TRANSITION", "Appointment must be completed");

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { shift_notes: body.notes },
    select: { shift_notes: true, updated_at: true },
  });
}

export async function getInterpreterAppointments(
  interpreterId: string,
  query: { status?: string; date_from?: string; date_to?: string; cursor?: string; limit: number },
  prisma: PrismaClient,
) {
  const statuses = query.status ? query.status.split(",") : undefined;
  const items = await prisma.appointment.findMany({
    where: {
      interpreter_id: interpreterId,
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(query.date_from || query.date_to
        ? {
            date_time: {
              ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
              ...(query.date_to ? { lte: new Date(query.date_to + "T23:59:59Z") } : {}),
            },
          }
        : {}),
    },
    take: query.limit + 1,
    orderBy: { date_time: "asc" },
    include: {
      type: true,
      clinic: { select: { id: true, name: true } },
      insurance_agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true, mrn: true } },
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data,
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function submitFollowUp(
  appointmentId: string,
  interpreterId: string,
  body: SubmitFollowUpBody,
  prisma: PrismaClient,
) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "completed") {
    throw new ValidationError("APPOINTMENT_NOT_COMPLETED", "Appointment must be completed");
  }

  const existing = await prisma.followUpResponse.findUnique({ where: { appointment_id: appointmentId } });
  if (existing) throw new ConflictError("FOLLOW_UP_ALREADY_SUBMITTED", "Follow-up already submitted");

  if (body.has_follow_up && !body.follow_up_datetime) {
    throw new ValidationError("MISSING_FOLLOW_UP_DATETIME", "follow_up_datetime is required");
  }

  const response = await prisma.followUpResponse.create({
    data: {
      appointment_id: appointmentId,
      interpreter_id: interpreterId,
      has_follow_up: body.has_follow_up,
      same_physician: body.same_physician ?? null,
      same_clinic: body.same_clinic ?? null,
      follow_up_datetime: body.follow_up_datetime ?? null,
      notes: body.notes ?? null,
    },
  });

  let draftId: string | null = null;
  if (body.has_follow_up) {
    const draft = await prisma.followUpDraft.create({
      data: { follow_up_response_id: response.id, status: "pending_review" },
    });
    draftId = draft.id;
  }

  return {
    follow_up_response: {
      id: response.id,
      has_follow_up: response.has_follow_up,
      same_physician: response.same_physician,
      same_clinic: response.same_clinic,
      follow_up_datetime: response.follow_up_datetime,
      notes: response.notes,
      media: [],
      draft_appointment_id: draftId,
      submitted_at: response.submitted_at.toISOString(),
    },
  };
}

export async function listFollowUpDrafts(
  organizationId: string,
  query: { status?: string; cursor?: string; limit: number },
  prisma: PrismaClient,
) {
  const items = await prisma.followUpDraft.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      follow_up_response: { appointment: { organization_id: organizationId } },
    },
    take: query.limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      follow_up_response: {
        include: {
          appointment: { include: { patient: true, clinic: true } },
          interpreter: { select: { id: true, name: true } },
          media: true,
        },
      },
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data: data.map((d) => ({
      id: d.id,
      status: d.status,
      created_from_appointment: {
        id: d.follow_up_response.appointment_id,
        date_time: d.follow_up_response.appointment.date_time.toISOString(),
      },
      patient: { id: d.follow_up_response.appointment.patient.id, name: d.follow_up_response.appointment.patient.name },
      clinic: d.follow_up_response.appointment.clinic
        ? { id: d.follow_up_response.appointment.clinic.id, name: d.follow_up_response.appointment.clinic.name }
        : null,
      interpreter: { id: d.follow_up_response.interpreter.id, name: d.follow_up_response.interpreter.name },
      follow_up_response: {
        same_physician: d.follow_up_response.same_physician,
        same_clinic: d.follow_up_response.same_clinic,
        follow_up_datetime: d.follow_up_response.follow_up_datetime,
        notes: d.follow_up_response.notes,
        media: d.follow_up_response.media.map((m) => ({ id: m.id, url: m.public_url, type: m.mime_type })),
      },
      created_at: d.created_at.toISOString(),
    })),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function reviewFollowUpDraft(
  draftId: string,
  organizationId: string,
  body: ReviewFollowUpDraftBody,
  prisma: PrismaClient,
) {
  const draft = await prisma.followUpDraft.findUnique({
    where: { id: draftId },
    include: { follow_up_response: { include: { appointment: true } } },
  });

  if (!draft || draft.follow_up_response.appointment.organization_id !== organizationId) {
    throw new NotFoundError("DRAFT_NOT_FOUND", "Draft not found");
  }
  if (draft.status !== "pending_review") {
    throw new ConflictError("DRAFT_ALREADY_RESOLVED", "Draft already resolved");
  }

  if (body.status === "dismissed") {
    await prisma.followUpDraft.update({ where: { id: draftId }, data: { status: "dismissed" } });
    return { draft_status: "dismissed", appointment: null };
  }

  if (!body.date_time) throw new ValidationError("MISSING_FOLLOW_UP_DATETIME", "date_time is required to schedule");

  const src = draft.follow_up_response.appointment;
  const appointment = await prisma.appointment.create({
    data: {
      organization_id: organizationId,
      status: "pending_offer",
      date_time: new Date(body.date_time),
      duration_minutes: src.duration_minutes,
      type_id: src.type_id,
      language: src.language,
      interpreter_type_required: src.interpreter_type_required,
      clinic_id: body.clinic_id ?? src.clinic_id,
      insurance_agency_id: body.insurance_agency_id ?? src.insurance_agency_id,
      patient_id: src.patient_id,
      referring_physician: src.referring_physician,
      pre_auth_amount: body.pre_auth_amount ?? src.pre_auth_amount,
      pre_auth_mileage: body.pre_auth_mileage ?? src.pre_auth_mileage,
      source: "follow_up",
    },
  });

  await prisma.followUpDraft.update({
    where: { id: draftId },
    data: { status: "scheduled", appointment_id: appointment.id },
  });

  return {
    draft_status: "scheduled",
    appointment: { id: appointment.id, status: "pending_offer", date_time: appointment.date_time.toISOString() },
  };
}
