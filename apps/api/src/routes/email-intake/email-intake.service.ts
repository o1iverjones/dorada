import type { PrismaClient } from "@prisma/client";
import type { ReviewEmailIntakeDraftBody, EmailIntakeLogListQuery, EmailIntakeDraftListQuery } from "@dorada/types";
import { NotFoundError, ConflictError } from "../../lib/errors.js";
import type { Queue } from "bullmq";

export async function listEmailIntakeLogs(
  query: EmailIntakeLogListQuery,
  organizationId: string,
  prisma: PrismaClient,
) {
  const statuses = query.status ? query.status.split(",") : undefined;
  const items = await prisma.emailIntakeLog.findMany({
    where: {
      organization_id: organizationId,
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(query.insurance_agency_id ? { insurance_agency_id: query.insurance_agency_id } : {}),
      ...(query.date_from || query.date_to
        ? {
            received_at: {
              ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
              ...(query.date_to ? { lte: new Date(query.date_to + "T23:59:59Z") } : {}),
            },
          }
        : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { received_at: "desc" },
    include: {
      insurance_agency: { select: { id: true, name: true } },
      draft: { select: { id: true } },
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data: data.map((log) => ({
      id: log.id,
      received_at: log.received_at.toISOString(),
      from_email: log.from_email,
      subject: log.subject,
      status: log.status,
      insurance_agency: log.insurance_agency,
      draft_appointment_id: log.draft?.id ?? null,
      confirmation_status: log.confirmation_status,
      confirmation_method: log.confirmation_method,
      has_unresolved_fields: log.has_unresolved_fields,
      duplicate_po: log.duplicate_po,
      processed_at: log.processed_at?.toISOString() ?? null,
    })),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function getEmailIntakeLog(id: string, organizationId: string, prisma: PrismaClient) {
  const log = await prisma.emailIntakeLog.findUnique({
    where: { id },
    include: {
      insurance_agency: { select: { id: true, name: true } },
      extraction: true,
      draft: true,
    },
  });

  if (!log || log.organization_id !== organizationId) {
    throw new NotFoundError("EMAIL_LOG_NOT_FOUND", "Email intake log not found");
  }

  return {
    ...log,
    received_at: log.received_at.toISOString(),
    processed_at: log.processed_at?.toISOString() ?? null,
    confirmation_executed_at: log.confirmation_executed_at?.toISOString() ?? null,
  };
}

export async function listEmailIntakeDrafts(
  query: EmailIntakeDraftListQuery,
  organizationId: string,
  prisma: PrismaClient,
) {
  const statuses = query.status ? query.status.split(",") : undefined;
  const items = await prisma.emailIntakeDraft.findMany({
    where: {
      log: { organization_id: organizationId },
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(query.has_unresolved_fields !== undefined ? { has_unresolved_fields: query.has_unresolved_fields } : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { created_at: "desc" },
    include: {
      log: { include: { insurance_agency: { select: { id: true, name: true } } } },
      appointment: { include: { patient: true, clinic: true } },
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data: data.map((d) => ({
      id: d.id,
      status: d.status,
      has_unresolved_fields: d.has_unresolved_fields,
      po_number: d.po_number,
      date_time: d.appointment?.date_time.toISOString() ?? null,
      patient: d.appointment ? { id: d.appointment.patient.id, name: d.appointment.patient.name, ai_generated: false } : null,
      clinic: d.appointment ? { id: d.appointment.clinic.id, name: d.appointment.clinic.name, ai_generated: false } : null,
      insurance_agency: d.log.insurance_agency,
      unresolved_fields: d.unresolved_fields,
      email_log_id: d.log_id,
      created_at: d.created_at.toISOString(),
    })),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function reviewEmailIntakeDraft(
  draftId: string,
  organizationId: string,
  body: ReviewEmailIntakeDraftBody,
  prisma: PrismaClient,
) {
  const draft = await prisma.emailIntakeDraft.findUnique({
    where: { id: draftId },
    include: { log: true },
  });

  if (!draft || draft.log.organization_id !== organizationId) {
    throw new NotFoundError("DRAFT_NOT_FOUND", "Draft not found");
  }
  if (draft.status !== "pending_review") {
    throw new ConflictError("DRAFT_ALREADY_RESOLVED", "Draft already resolved");
  }

  if (body.status === "dismissed") {
    await prisma.$transaction([
      prisma.emailIntakeDraft.update({ where: { id: draftId }, data: { status: "dismissed" } }),
      prisma.emailIntakeLog.update({ where: { id: draft.log_id }, data: { status: "flagged" } }),
    ]);
    return { draft_status: "dismissed", appointment: null };
  }

  const appointment = await prisma.appointment.create({
    data: {
      organization_id: organizationId,
      status: "pending_offer",
      date_time: new Date(body.date_time!),
      duration_minutes: 60,
      type_id: body.type_id!,
      language: body.languages?.[0] ?? "en",
      interpreter_type_required: body.interpreter_type_required ?? "qualified",
      clinic_id: body.clinic_id!,
      insurance_agency_id: body.insurance_agency_id!,
      patient_id: body.patient_id!,
      referring_physician: body.referring_physician ?? null,
      department: body.department ?? null,
      pre_auth_amount: body.pre_auth_amount ?? 0,
      pre_auth_mileage: body.pre_auth_mileage ?? 0,
      po_number: draft.po_number,
      source: "email_intake",
    },
  });

  await prisma.emailIntakeDraft.update({
    where: { id: draftId },
    data: { status: "approved", appointment_id: appointment.id },
  });

  return {
    draft_status: "approved",
    appointment: { id: appointment.id, status: "pending_offer", po_number: draft.po_number, date_time: appointment.date_time.toISOString() },
  };
}

export async function retryConfirmation(logId: string, organizationId: string, prisma: PrismaClient, emailIntakeQueue: Queue) {
  const log = await prisma.emailIntakeLog.findUnique({ where: { id: logId } });
  if (!log || log.organization_id !== organizationId) {
    throw new NotFoundError("EMAIL_LOG_NOT_FOUND", "Log not found");
  }
  if (log.confirmation_status === "success") {
    throw new ConflictError("CONFIRMATION_ALREADY_SUCCEEDED", "Confirmation already succeeded");
  }

  const jobId = crypto.randomUUID();
  await emailIntakeQueue.add("retry-confirmation", { logId, organizationId }, { jobId });

  return { message: "Confirmation retry enqueued.", job_id: jobId };
}
