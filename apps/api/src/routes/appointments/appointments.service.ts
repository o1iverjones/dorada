import type { PrismaClient } from "@prisma/client";
import { localDayToUtcRange } from "../../lib/geo.js";
import type {
  CreateAppointmentBody,
  UpdateAppointmentBody,
  OfferAppointmentBody,
  ShiftNotesBody,
  SubmitFollowUpBody,
  ReviewFollowUpDraftBody,
  AppointmentListQuery,
} from "@dorada/types";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
} from "../../lib/errors.js";
import { addMinutes, diffMinutes } from "@dorada/utils";
import { writeActivityLog } from "../../lib/activityLog.js";
import { distanceMiles } from "../../lib/geo.js";
import { sendExpoPushNotifications } from "../../lib/push.js";

async function logActivity(
  appointmentId: string,
  organizationId: string,
  action: string,
  adminName: string,
  adminId: string | null,
  detail: string | null,
  prisma: PrismaClient,
  entityName?: string | null,
  poNumber?: string | null,
) {
  await prisma.appointmentActivity.create({
    data: { appointment_id: appointmentId, organization_id: organizationId, action, admin_name: adminName, admin_id: adminId, detail },
  });
  await writeActivityLog(prisma, {
    organizationId,
    entityType: "appointment",
    entityId: appointmentId,
    entityName: entityName ?? null,
    action,
    detail,
    poNumber: poNumber ?? null,
    adminId,
    adminName,
  });
}

function ensureTenant(record: { organization_id: string } | null, organizationId: string, code: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError(code, "Resource not found");
  }
}

const ADMIN_RESOLVABLE_STATUSES = [
  "cancelled", "late_cancellation", "no_show", "rescheduled",
  "double_booking", "pt_speaks_eng", "dr_speaks_es",
];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  unassigned:    [...ADMIN_RESOLVABLE_STATUSES],
  pending_offer: ["confirmed", ...ADMIN_RESOLVABLE_STATUSES],
  confirmed:     ["in_progress", ...ADMIN_RESOLVABLE_STATUSES],
  in_progress:   ["completed", ...ADMIN_RESOLVABLE_STATUSES],
  completed:     [...ADMIN_RESOLVABLE_STATUSES],
  // Allow re-classification between admin-resolvable statuses
  ...Object.fromEntries(ADMIN_RESOLVABLE_STATUSES.map((s) => [s, ADMIN_RESOLVABLE_STATUSES.filter((t) => t !== s)])),
};

function assertValidTransition(from: string, to: string) {
  if (from === to) return;
  if (!STATUS_TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError("INVALID_STATUS_TRANSITION", `Cannot transition from ${from} to ${to}`);
  }
}

export async function listAppointments(query: AppointmentListQuery, organizationId: string, prisma: PrismaClient) {
  const statuses = query.status ? query.status.split(",") : undefined;

  // Resolve org timezone so date_from/date_to are treated as local calendar dates
  let tz = "UTC";
  if (query.date_from || query.date_to) {
    const settings = await prisma.systemSettings.findUnique({ where: { organization_id: organizationId } });
    tz = settings?.timezone ?? "America/Los_Angeles";
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (query.date_from) dateFilter.gte = localDayToUtcRange(query.date_from, tz).gte;
  if (query.date_to)   dateFilter.lte = localDayToUtcRange(query.date_to, tz).lte;

  const where = {
    organization_id: organizationId,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(query.interpreter_id ? { interpreter_id: query.interpreter_id } : {}),
    ...(query.clinic_id ? { clinic_id: query.clinic_id } : {}),
    ...(query.agency_id ? { agency_id: query.agency_id } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.type_id ? { type_id: query.type_id } : {}),
    ...((query.date_from || query.date_to) ? { date_time: dateFilter } : {}),
    ...(query.cursor ? { id: { gt: query.cursor } } : {}),
  };

  const items = await prisma.appointment.findMany({
    where,
    take: query.limit + 1,
    orderBy: { date_time: "asc" },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true, profile_picture_url: true, pay_rate: true } },
      clinic: { select: { id: true, name: true } },
      agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true } },
      offers: { where: { status: "pending" }, select: { interpreter: { select: { id: true, name: true } } } },
      invoice: { select: { id: true, status: true, billable_minutes: true } },
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
      clinic: { select: { id: true, name: true, address: true, parking: true, phone: true } },
      agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true, date_of_birth: true } },
      offers: { include: { interpreter: { select: { id: true, name: true } } } },
      invoice: { select: { id: true, status: true, amount: true, submitted_at: true } },
    },
  });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  return appt;
}

export async function getOrgActivityLog(organizationId: string, limit: number, prisma: PrismaClient) {
  return prisma.appointmentActivity.findMany({
    where: { organization_id: organizationId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: { appointment: { select: { id: true, patient: { select: { name: true } } } } },
  });
}

export async function getActivityLog(id: string, organizationId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { organization_id: true } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  return prisma.appointmentActivity.findMany({
    where: { appointment_id: id },
    orderBy: { created_at: "desc" },
  });
}

export async function getAdminNotes(id: string, organizationId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { organization_id: true } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  return prisma.appointmentNote.findMany({
    where: { appointment_id: id },
    orderBy: { created_at: "desc" },
  });
}

export async function addAdminNote(
  id: string,
  content: string,
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
  imageUrl: string | null = null,
) {
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { organization_id: true, po_number: true, patient: { select: { name: true } } } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  const note = await prisma.appointmentNote.create({
    data: { appointment_id: id, organization_id: organizationId, content, admin_id: actor.id, admin_name: actor.name, image_url: imageUrl },
  });
  await logActivity(id, organizationId, "note_added", actor.name, actor.id, null, prisma, appt!.patient?.name, appt!.po_number);
  return note;
}

export async function createAppointment(
  body: CreateAppointmentBody,
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
) {
  // Guard: reject deactivated clinics
  const clinic = await prisma.clinic.findUnique({
    where: { id: body.clinic_id },
    select: { is_active: true },
  });
  if (!clinic || clinic.is_active === false) {
    throw new ValidationError("CLINIC_INACTIVE", "The selected clinic is deactivated and cannot accept new appointments");
  }

  const appt = await prisma.appointment.create({
    data: {
      organization_id: organizationId,
      date_time: new Date(body.date_time),
      duration_minutes: body.duration_minutes,
      type_id: body.type_id,
      language: body.language,
      interpreter_type_required: body.interpreter_type_required,
      clinic_id: body.clinic_id,
      agency_id: body.agency_id,
      patient_id: body.patient_id,
      referring_physician: body.referring_physician ?? null,
      department: body.department ?? null,
      pre_auth_amount: body.pre_auth_amount,
      pre_auth_mileage: body.pre_auth_mileage,
      po_number: body.po_number ?? null,
      billing_interpreter: body.billing_interpreter ?? null,
      status: "unassigned",
      source: "manual",
    },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true } },
    },
  });
  await logActivity(appt.id, organizationId, "created", actor.name, actor.id, null, prisma, appt.patient?.name, appt.po_number);
  return appt;
}

export async function updateAppointment(
  id: string,
  body: UpdateAppointmentBody,
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");

  if (body.status) assertValidTransition(appt!.status, body.status);

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      ...(body.date_time ? { date_time: new Date(body.date_time) } : {}),
      ...(body.duration_minutes !== undefined ? { duration_minutes: body.duration_minutes } : {}),
      ...(body.type_id ? { type_id: body.type_id } : {}),
      ...(body.language ? { language: body.language } : {}),
      ...(body.interpreter_type_required ? { interpreter_type_required: body.interpreter_type_required } : {}),
      ...(body.clinic_id ? { clinic_id: body.clinic_id } : {}),
      ...(body.agency_id ? { agency_id: body.agency_id } : {}),
      ...(body.patient_id ? { patient_id: body.patient_id } : {}),
      ...(body.referring_physician !== undefined ? { referring_physician: body.referring_physician } : {}),
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.po_number !== undefined ? { po_number: body.po_number || null } : {}),
      ...(body.billing_interpreter !== undefined ? { billing_interpreter: body.billing_interpreter || null } : {}),
      ...(body.pre_auth_amount !== undefined ? { pre_auth_amount: body.pre_auth_amount } : {}),
      ...(body.pre_auth_mileage !== undefined ? { pre_auth_mileage: body.pre_auth_mileage } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
    include: {
      type: true,
      interpreter: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true } },
    },
  });
  const FIELD_LABELS: Record<string, string> = {
    duration_minutes: "Duration",
    type_id: "Appointment Type",
    language: "Language",
    interpreter_type_required: "Interpreter Type",
    clinic_id: "Clinic",
    agency_id: "Insurance Agency",
    patient_id: "Patient",
    referring_physician: "Provider",
    department: "Department",
    pre_auth_amount: "Pre-Auth Amount",
    pre_auth_mileage: "Pre-Auth Mileage",
    po_number: "PO Number",
    billing_interpreter: "Billing Interpreter",
  };

  if (body.status && body.status !== appt!.status) {
    await logActivity(id, organizationId, "status_changed", actor.name, actor.id, `Status changed to ${body.status}`, prisma, updated.patient?.name, updated.po_number);
  } else {
    const changed: string[] = [];
    if (body.date_time !== undefined) {
      const newDt = new Date(body.date_time);
      const oldDt = appt!.date_time;
      if (newDt.toISOString().slice(0, 10) !== oldDt.toISOString().slice(0, 10)) changed.push("Date");
      if (newDt.toISOString().slice(11, 16) !== oldDt.toISOString().slice(11, 16)) changed.push("Time");
    }
    if (body.duration_minutes !== undefined && body.duration_minutes !== appt!.duration_minutes) changed.push(FIELD_LABELS.duration_minutes);
    if (body.type_id !== undefined && body.type_id !== appt!.type_id) changed.push(FIELD_LABELS.type_id);
    if (body.language !== undefined && body.language !== appt!.language) changed.push(FIELD_LABELS.language);
    if (body.interpreter_type_required !== undefined && body.interpreter_type_required !== appt!.interpreter_type_required) changed.push(FIELD_LABELS.interpreter_type_required);
    if (body.clinic_id !== undefined && body.clinic_id !== appt!.clinic_id) changed.push(FIELD_LABELS.clinic_id);
    if (body.agency_id !== undefined && body.agency_id !== appt!.agency_id) changed.push(FIELD_LABELS.agency_id);
    if (body.patient_id !== undefined && body.patient_id !== appt!.patient_id) changed.push(FIELD_LABELS.patient_id);
    if (body.referring_physician !== undefined && (body.referring_physician ?? null) !== appt!.referring_physician) changed.push(FIELD_LABELS.referring_physician);
    if (body.department !== undefined && (body.department ?? null) !== appt!.department) changed.push(FIELD_LABELS.department);
    if (body.pre_auth_amount !== undefined && Number(body.pre_auth_amount) !== Number(appt!.pre_auth_amount)) changed.push(FIELD_LABELS.pre_auth_amount);
    if (body.pre_auth_mileage !== undefined && body.pre_auth_mileage !== appt!.pre_auth_mileage) changed.push(FIELD_LABELS.pre_auth_mileage);
    if (body.po_number !== undefined && (body.po_number ?? null) !== appt!.po_number) changed.push(FIELD_LABELS.po_number);
    if (body.billing_interpreter !== undefined && (body.billing_interpreter ?? null) !== appt!.billing_interpreter) changed.push(FIELD_LABELS.billing_interpreter);
    await logActivity(id, organizationId, "updated", actor.name, actor.id, changed.length ? changed.join(", ") : null, prisma, updated.patient?.name, updated.po_number);
  }
  return updated;
}

export async function patchClockTimes(
  id: string,
  body: { clock_in_time?: string; patient_arrived_at?: string; clock_out_time?: string },
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
) {
  const [appt, settings] = await Promise.all([
    prisma.appointment.findUnique({ where: { id }, include: { patient: { select: { name: true } } } }),
    prisma.systemSettings.findUnique({ where: { organization_id: organizationId } }),
  ]);
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");

  const clockIn = body.clock_in_time !== undefined ? new Date(body.clock_in_time) : undefined;
  const patientArrived = body.patient_arrived_at !== undefined ? new Date(body.patient_arrived_at) : undefined;
  const clockOut = body.clock_out_time !== undefined ? new Date(body.clock_out_time) : undefined;

  // Recalculate actual duration when both times are known
  const inTime = clockIn ?? appt!.clock_in_time;
  const outTime = clockOut ?? appt!.clock_out_time;
  const actualMinutes = inTime && outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : undefined;

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      ...(clockIn !== undefined ? { clock_in_time: clockIn } : {}),
      ...(patientArrived !== undefined ? { patient_arrived_at: patientArrived } : {}),
      ...(clockOut !== undefined ? { clock_out_time: clockOut } : {}),
      ...(actualMinutes !== undefined ? { actual_duration_minutes: actualMinutes } : {}),
    },
  });

  const tz = settings?.timezone ?? "America/Los_Angeles";
  const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(d);
  const changed: string[] = [];
  if (clockIn !== undefined) changed.push(`Clock-in → ${fmtTime(updated.clock_in_time!)}`);
  if (patientArrived !== undefined) changed.push(`Patient arrived → ${fmtTime(updated.patient_arrived_at!)}`);
  if (clockOut !== undefined) changed.push(`Clock-out → ${fmtTime(updated.clock_out_time!)}`);

  await logActivity(id, organizationId, "clock_times_edited", actor.name, actor.id, changed.join("; "), prisma, appt!.patient?.name, appt!.po_number);

  return updated;
}

export async function cancelAppointment(id: string, organizationId: string, actor: { id: string; name: string }, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id }, include: { patient: { select: { name: true } } } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  assertValidTransition(appt!.status, "cancelled");

  await prisma.$transaction([
    prisma.appointment.update({ where: { id }, data: { status: "cancelled" } }),
    prisma.appointmentOffer.updateMany({
      where: { appointment_id: id, status: "pending" },
      data: { status: "expired" },
    }),
  ]);
  await logActivity(id, organizationId, "cancelled", actor.name, actor.id, null, prisma, appt!.patient?.name ?? null, appt!.po_number);
}

export async function unassignInterpreter(id: string, organizationId: string, actor: { id: string; name: string }, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id }, include: { patient: { select: { name: true } } } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");

  if (!appt!.interpreter_id) throw new ConflictError("NO_INTERPRETER", "Appointment has no interpreter assigned");
  if (!["confirmed", "pending_offer", "unassigned"].includes(appt!.status)) {
    throw new ValidationError("INVALID_STATUS_TRANSITION", "Cannot unassign interpreter from an appointment that is in progress or completed");
  }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id },
      data: { interpreter_id: null, status: "unassigned" },
    }),
    prisma.appointmentOffer.updateMany({
      where: { appointment_id: id },
      data: { status: "expired" },
    }),
  ]);

  await logActivity(id, organizationId, "interpreter_unassigned", actor.name, actor.id, null, prisma, appt!.patient?.name ?? null, appt!.po_number);
}

export async function patchBilling(
  id: string,
  body: {
    billing_billed?: boolean;
    billing_invoiced?: boolean;
    billing_lost?: boolean;
    billing_payment_under_claim?: boolean;
    billing_pending_auth?: boolean;
    billing_retro?: boolean;
    billing_payment_status?: string;
    billing_approval_status?: string;
  },
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
) {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: { patient: { select: { name: true } } },
  });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");

  const updated = await prisma.appointment.update({ where: { id }, data: body });

  // Build a human-readable description of every field that changed
  const BOOL_LABELS: Record<string, string> = {
    billing_billed:               "Billed",
    billing_invoiced:             "Invoiced",
    billing_lost:                 "Lost",
    billing_payment_under_claim:  "Payment Under Claim",
    billing_pending_auth:         "Pending Auth",
    billing_retro:                "Retro",
  };
  const STATUS_LABELS: Record<string, string> = {
    billing_payment_status:  "Payment",
    billing_approval_status: "Approval",
  };
  const STATUS_VALUES: Record<string, Record<string, string>> = {
    billing_payment_status:  { not_paid: "Not Paid", paid: "Paid" },
    billing_approval_status: { pending_approval: "Pending Approval", approved: "Approved" },
  };

  const changes: string[] = [];

  for (const [field, label] of Object.entries(BOOL_LABELS)) {
    const newVal = (body as Record<string, unknown>)[field];
    if (newVal === undefined) continue;
    const oldVal = (appt as Record<string, unknown>)[field];
    if (newVal !== oldVal) {
      changes.push(`${label} ${newVal ? "checked" : "unchecked"}`);
    }
  }
  for (const [field, label] of Object.entries(STATUS_LABELS)) {
    const newVal = (body as Record<string, unknown>)[field] as string | undefined;
    if (newVal === undefined) continue;
    const oldVal = (appt as Record<string, unknown>)[field] as string;
    if (newVal !== oldVal) {
      changes.push(`${label}: ${STATUS_VALUES[field][newVal] ?? newVal}`);
    }
  }

  if (changes.length > 0) {
    await logActivity(
      id,
      organizationId,
      "billing_updated",
      actor.name,
      actor.id,
      changes.join(", "),
      prisma,
      appt!.patient?.name ?? null,
      appt!.po_number,
    );
  }

  return updated;
}

export async function offerAppointment(
  id: string,
  body: OfferAppointmentBody,
  organizationId: string,
  actor: { id: string; name: string },
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

  const existingOffers = await prisma.appointmentOffer.findMany({
    where: { appointment_id: id, interpreter_id: { in: body.interpreter_ids } },
  });
  const alreadyOffered = new Set(existingOffers.map((o) => o.interpreter_id));

  type OfferWithInterpreter = { id: string; appointment_id: string; interpreter_id: string; status: string; expires_at: Date | null; offered_at: Date; responded_at: Date | null; interpreter: { id: string; name: string } };
  const offers: Promise<OfferWithInterpreter>[] = [];
  for (const interpreter of interpreters) {
    if (alreadyOffered.has(interpreter.id)) continue;

    const requiredType = appt!.interpreter_type_required.toLowerCase();
    const eligible = interpreter.type === "certified" || interpreter.type === "qualified_and_certified" || requiredType === "qualified";
    if (!eligible) {
      throw new ValidationError("INTERPRETER_NOT_ELIGIBLE", `Interpreter ${interpreter.name} is qualified-only and cannot be assigned to a certified appointment`);
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
      }) as Promise<OfferWithInterpreter>,
    );
  }

  const created = await Promise.all(offers);
  const names = created.map((o) => o.interpreter.name).join(", ");

  // If the appointment was unassigned or declined, move it to pending_offer now that an offer exists
  if (created.length > 0 && (appt!.status === "declined" || appt!.status === "unassigned")) {
    await prisma.appointment.update({ where: { id }, data: { status: "pending_offer" } });
  }

  await logActivity(id, organizationId, "offer_sent", actor.name, actor.id, `Offered to: ${names}`, prisma, null, appt!.po_number);

  // Send push notifications to each offered interpreter
  const interpreterIds = created.map((o) => o.interpreter_id);
  const tokens = await prisma.interpreter.findMany({
    where: { id: { in: interpreterIds }, fcm_token: { not: null } },
    select: { fcm_token: true },
  });
  const apptDate = new Date(appt!.date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const messages = tokens
    .map((t) => t.fcm_token!)
    .filter((token) => token.startsWith("ExponentPushToken"))
    .map((token) => ({
      to: token,
      title: "New Appointment Offer",
      body: `You have a new appointment offer for ${apptDate}. Tap to view details.`,
      data: { appointmentId: id, type: "offer" },
      sound: "default" as const,
      priority: "high" as const,
    }));
  await sendExpoPushNotifications(messages);

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

export async function manualConfirmInterpreter(
  appointmentId: string,
  interpreterId: string,
  organizationId: string,
  prisma: PrismaClient,
) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.organization_id !== organizationId) {
    throw new NotFoundError("APPOINTMENT_NOT_FOUND", "Appointment not found");
  }
  if (!["pending_offer", "unassigned"].includes(appointment.status)) {
    throw new ConflictError("INVALID_STATUS", "Appointment is not in pending_offer status");
  }
  if (appointment.interpreter_id) {
    throw new ConflictError("ALREADY_CONFIRMED", "Appointment already has an interpreter assigned");
  }

  const interpreter = await prisma.interpreter.findUnique({ where: { id: interpreterId } });
  if (!interpreter || interpreter.organization_id !== organizationId) {
    throw new NotFoundError("INTERPRETER_NOT_FOUND", "Interpreter not found");
  }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { interpreter_id: interpreterId, status: "confirmed" },
    }),
    prisma.appointmentOffer.updateMany({
      where: { appointment_id: appointmentId, status: "pending" },
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

  // If no other pending offers exist, flip the appointment status to "declined"
  const remainingPending = await prisma.appointmentOffer.count({
    where: { appointment_id: appointmentId, status: "pending" },
  });
  if (remainingPending === 0) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "declined" },
    });
  }

  return { offer: { id: offerId, status: "declined" } };
}

export async function clockIn(
  appointmentId: string,
  interpreterId: string,
  prisma: PrismaClient,
  lat?: number,
  lng?: number,
) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { clinic: { select: { location_lat: true, location_lng: true } } },
  });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "confirmed") throw new ValidationError("INVALID_STATUS_TRANSITION", "Appointment must be confirmed");
  if (appt.clock_in_time) throw new ConflictError("ALREADY_CLOCKED_IN", "Already clocked in");

  // Compute distance from clinic if both interpreter and clinic coordinates are available
  let distMiles: number | null = null;
  if (lat != null && lng != null && appt.clinic?.location_lat != null && appt.clinic?.location_lng != null) {
    distMiles = distanceMiles(lat, lng, appt.clinic.location_lat, appt.clinic.location_lng);
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      clock_in_time: new Date(),
      status: "in_progress",
      ...(lat != null ? { clock_in_lat: lat } : {}),
      ...(lng != null ? { clock_in_lng: lng } : {}),
      ...(distMiles != null ? { clock_in_distance_miles: distMiles } : {}),
    },
  });

  return {
    clock_in_time: updated.clock_in_time!.toISOString(),
    status: "in_progress",
    clock_in_distance_miles: distMiles,
  };
}

export async function clockOut(appointmentId: string, interpreterId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      type: true,
      interpreter: { select: { pay_rate: true } },
    },
  });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "in_progress") throw new ValidationError("INVALID_STATUS_TRANSITION", "Must be in progress");

  const now = new Date();
  const actualMinutes = appt.clock_in_time ? diffMinutes(appt.clock_in_time.toISOString(), now.toISOString()) : 0;
  const billableMinutes = Math.max(actualMinutes, appt.type.minimum_billable_minutes);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { clock_out_time: now, status: "completed", actual_duration_minutes: actualMinutes, billable_duration_minutes: billableMinutes },
  });

  // Determine pay rate: appointment-level → interpreter-level → system default
  let payRate = appt.pay_rate ? Number(appt.pay_rate) : null;
  if (!payRate) payRate = appt.interpreter?.pay_rate ? Number(appt.interpreter.pay_rate) : null;
  if (!payRate) {
    const settings = await prisma.systemSettings.findUnique({ where: { organization_id: appt.organization_id } });
    const isQualified = appt.interpreter_type_required.toLowerCase() === "qualified";
    payRate = settings
      ? Number(isQualified ? settings.default_pay_rate_qualified : settings.default_pay_rate_certified)
      : 30;
  }

  const amount = payRate * (billableMinutes / 60.0);

  await prisma.invoice.create({
    data: {
      organization_id: appt.organization_id,
      appointment_id: appointmentId,
      interpreter_id: interpreterId,
      status: "submitted",
      amount,
      billable_minutes: billableMinutes,
      pay_rate: payRate,
    },
  });

  return {
    clock_out_time: now.toISOString(),
    actual_duration_minutes: actualMinutes,
    billable_duration_minutes: billableMinutes,
    status: "completed",
  };
}

export async function markPatientArrived(appointmentId: string, interpreterId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  if (appt.status !== "in_progress") throw new ValidationError("INVALID_STATUS", "Appointment must be in progress");
  if (appt.patient_arrived_at) throw new ConflictError("ALREADY_MARKED", "Patient already marked as arrived");

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { patient_arrived_at: new Date() },
  });

  return { patient_arrived_at: updated.patient_arrived_at!.toISOString() };
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
  if (appt.status !== "completed" && appt.status !== "in_progress") {
    throw new ValidationError("INVALID_STATUS_TRANSITION", "Appointment must be in progress or completed");
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { shift_notes: body.notes },
    select: { shift_notes: true, updated_at: true },
  });
}

export async function getInterpreterAppointment(appointmentId: string, interpreterId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      type: true,
      clinic: {
        select: {
          id: true, name: true, address: true, parking: true,
          interpreter_notes: { where: { is_active: true }, select: { id: true, content: true, type: true }, orderBy: { created_at: "asc" } },
        },
      },
      agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true } },
      invoice: { select: { id: true, status: true, amount: true } },
      media: { select: { id: true, public_url: true, filename: true, mime_type: true, file_size: true, uploaded_at: true }, orderBy: { uploaded_at: "asc" } },
    },
  });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  return { ...appt, invoice: appt.invoice ? { ...appt.invoice, amount: Number(appt.invoice.amount) } : null };
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
      clinic: {
        select: {
          id: true, name: true,
          interpreter_notes: { where: { is_active: true }, select: { id: true, type: true }, orderBy: { created_at: "asc" } },
        },
      },
      agency: { select: { id: true, name: true } },
      patient: { select: { id: true, name: true } },
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data,
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function getInterpreterOffers(interpreterId: string, prisma: PrismaClient) {
  const offers = await prisma.appointmentOffer.findMany({
    where: { interpreter_id: interpreterId, status: "pending", expires_at: { gt: new Date() } },
    include: {
      appointment: {
        include: {
          clinic: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
          patient: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { offered_at: "desc" },
  });

  return {
    data: offers.map((o) => ({
      offer_id: o.id,
      id: o.appointment_id,
      expires_at: o.expires_at,
      date_time: o.appointment.date_time,
      duration_minutes: o.appointment.duration_minutes,
      language: o.appointment.language,
      interpreter_type_required: o.appointment.interpreter_type_required,
      clinic_name: o.appointment.clinic?.name ?? null,
      agency_name: o.appointment.agency?.name ?? null,
      patient_name: o.appointment.patient?.name ?? null,
    })),
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
          appointment: { include: { patient: true, clinic: true, agency: true } },
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
      agency: d.follow_up_response.appointment.agency
        ? { id: d.follow_up_response.appointment.agency.id, name: d.follow_up_response.appointment.agency.name }
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
      status: "unassigned",
      date_time: new Date(body.date_time),
      duration_minutes: src.duration_minutes,
      type_id: src.type_id,
      language: src.language,
      interpreter_type_required: src.interpreter_type_required,
      clinic_id: body.clinic_id ?? src.clinic_id,
      agency_id: body.agency_id ?? src.agency_id,
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
    appointment: { id: appointment.id, status: "unassigned", date_time: appointment.date_time.toISOString() },
  };
}

export async function uploadAppointmentMedia(params: {
  appointmentId: string;
  interpreterId: string;
  organizationId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  gcsPath: string;
  publicUrl: string;
  prisma: PrismaClient;
}) {
  const { appointmentId, interpreterId, organizationId, filename, mimeType, fileSize, gcsPath, publicUrl, prisma } = params;
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.interpreter_id !== interpreterId) {
    throw new ForbiddenError("NOT_ASSIGNED_INTERPRETER", "Not the assigned interpreter");
  }
  return prisma.appointmentMedia.create({
    data: { appointment_id: appointmentId, interpreter_id: interpreterId, organization_id: organizationId, filename, mime_type: mimeType, file_size: fileSize, gcs_path: gcsPath, public_url: publicUrl },
    select: { id: true, public_url: true, filename: true, mime_type: true, file_size: true, uploaded_at: true },
  });
}

export async function getAppointmentMedia(appointmentId: string, organizationId: string, prisma: PrismaClient) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  ensureTenant(appt, organizationId, "APPOINTMENT_NOT_FOUND");
  return prisma.appointmentMedia.findMany({
    where: { appointment_id: appointmentId },
    select: { id: true, public_url: true, filename: true, mime_type: true, file_size: true, uploaded_at: true, interpreter: { select: { name: true } } },
    orderBy: { uploaded_at: "asc" },
  });
}
