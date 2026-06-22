import type { PrismaClient } from "@prisma/client";
import type { CreateClinicBody, UpdateClinicBody, ClinicListQuery, CreateClinicInterpreterNoteBody, UpdateClinicInterpreterNoteBody } from "@dorada/types";
import { NotFoundError, ConflictError, ValidationError } from "../../lib/errors.js";
import { geocodeAddress } from "../../lib/geo.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("CLINIC_NOT_FOUND", "Clinic not found");
  }
}

export async function listClinics(query: ClinicListQuery, organizationId: string, prisma: PrismaClient) {
  const items = await prisma.clinic.findMany({
    where: {
      organization_id: organizationId,
      // include both active and inactive so the list can shade deactivated rows
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { name: "asc" },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data: data.map(formatClinic),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

function formatClinic(c: {
  id: string; name: string; address: string | null; city: string | null; state: string | null; zip_code: string | null;
  parking: string | null; phone: string | null;
  primary_contact_name: string | null; primary_contact_phone: string | null; primary_contact_email: string | null;
  billing_model: string; billing_hourly_rate: unknown; billing_flat_rate: unknown;
  billing_invoice_cycle: string; is_active: boolean;
  confirmation_emails_enabled: boolean; summary_emails_enabled: boolean; summary_email_days: number[];
  created_at: Date; updated_at: Date;
}) {
  return {
    id: c.id, name: c.name, address: c.address, city: c.city, state: c.state, zip_code: c.zip_code, parking: c.parking, phone: c.phone,
    primary_contact: (c.primary_contact_name || c.primary_contact_email || c.primary_contact_phone) ? {
      name: c.primary_contact_name,
      phone: c.primary_contact_phone,
      email: c.primary_contact_email,
    } : null,
    billing: {
      model: c.billing_model,
      hourly_rate: c.billing_hourly_rate ? Number(c.billing_hourly_rate) : null,
      flat_rate: c.billing_flat_rate ? Number(c.billing_flat_rate) : null,
      invoice_cycle: c.billing_invoice_cycle,
    },
    is_active: c.is_active,
    confirmation_emails_enabled: c.confirmation_emails_enabled,
    summary_emails_enabled: c.summary_emails_enabled,
    summary_email_days: c.summary_email_days,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}

export async function getClinic(id: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
    include: {
      interpreters_blocked: { include: { interpreter: { select: { id: true, name: true } } } },
      doctors: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  ensureTenant(clinic, organizationId);
  return {
    ...formatClinic(clinic!),
    interpreters_not_allowed: clinic!.interpreters_blocked.map((b) => b.interpreter),
    doctors: clinic!.doctors,
  };
}

export async function listClinicDoctors(clinicId: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  return prisma.clinicDoctor.findMany({ where: { clinic_id: clinicId }, orderBy: { name: "asc" } });
}

export async function addClinicDoctor(clinicId: string, name: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  return prisma.clinicDoctor.create({ data: { clinic_id: clinicId, name } });
}

export async function removeClinicDoctor(clinicId: string, doctorId: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  const doctor = await prisma.clinicDoctor.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.clinic_id !== clinicId) throw new NotFoundError("DOCTOR_NOT_FOUND", "Doctor not found");
  await prisma.clinicDoctor.delete({ where: { id: doctorId } });
}

export async function createClinic(body: CreateClinicBody, organizationId: string, prisma: PrismaClient) {
  validateBilling(body.billing);
  const coords = body.address ? await geocodeAddress(body.address) : null;
  return prisma.clinic.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip_code: body.zip_code ?? null,
      location_lat: coords ? coords[0] : null,
      location_lng: coords ? coords[1] : null,
      parking: body.parking ?? null,
      phone: body.phone ?? null,
      primary_contact_name: body.primary_contact?.name || null,
      primary_contact_phone: body.primary_contact?.phone || null,
      primary_contact_email: body.primary_contact?.email || null,
      billing_model: body.billing.model,
      billing_hourly_rate: body.billing.hourly_rate ?? null,
      billing_flat_rate: body.billing.flat_rate ?? null,
      billing_invoice_cycle: body.billing.invoice_cycle,
      confirmation_emails_enabled: body.confirmation_emails_enabled ?? false,
      summary_emails_enabled: body.summary_emails_enabled ?? false,
      summary_email_days: body.summary_email_days ?? [],
    },
  });
}

function validateBilling(billing: { model: string; hourly_rate?: number | null; flat_rate?: number | null }) {
  if ((billing.model === "hourly" || billing.model === "mixed") && billing.hourly_rate == null) {
    throw new ValidationError("INVALID_BILLING_CONFIG", "hourly_rate required for hourly/mixed model");
  }
  if ((billing.model === "flat" || billing.model === "mixed") && billing.flat_rate == null) {
    throw new ValidationError("INVALID_BILLING_CONFIG", "flat_rate required for flat/mixed model");
  }
}

export async function updateClinic(id: string, body: UpdateClinicBody, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id } });
  ensureTenant(clinic, organizationId);
  if (body.billing) validateBilling(body.billing);

  // Re-geocode if the address has changed
  let coordsUpdate: { location_lat: number | null; location_lng: number | null } | undefined;
  if (body.address !== undefined) {
    const coords = body.address ? await geocodeAddress(body.address) : null;
    coordsUpdate = { location_lat: coords ? coords[0] : null, location_lng: coords ? coords[1] : null };
  }

  return prisma.clinic.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(coordsUpdate ?? {}),
      ...(body.city !== undefined ? { city: body.city ?? null } : {}),
      ...(body.state !== undefined ? { state: body.state ?? null } : {}),
      ...(body.zip_code !== undefined ? { zip_code: body.zip_code ?? null } : {}),
      ...(body.parking !== undefined ? { parking: body.parking } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.primary_contact
        ? { primary_contact_name: body.primary_contact.name || null, primary_contact_phone: body.primary_contact.phone || null, primary_contact_email: body.primary_contact.email || null }
        : {}),
      ...(body.billing ? { billing_model: body.billing.model, billing_hourly_rate: body.billing.hourly_rate ?? null, billing_flat_rate: body.billing.flat_rate ?? null, billing_invoice_cycle: body.billing.invoice_cycle } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      ...(body.confirmation_emails_enabled !== undefined ? { confirmation_emails_enabled: body.confirmation_emails_enabled } : {}),
      ...(body.summary_emails_enabled !== undefined ? { summary_emails_enabled: body.summary_emails_enabled } : {}),
      ...(body.summary_email_days !== undefined ? { summary_email_days: body.summary_email_days } : {}),
    },
  });
}

export async function setInterpreterBlocks(id: string, interpreterIds: string[], organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id } });
  ensureTenant(clinic, organizationId);

  await prisma.clinicInterpreterBlock.deleteMany({ where: { clinic_id: id } });

  if (interpreterIds.length > 0) {
    await prisma.clinicInterpreterBlock.createMany({
      data: interpreterIds.map((interpreter_id) => ({ clinic_id: id, interpreter_id })),
    });
  }

  const updated = await prisma.clinicInterpreterBlock.findMany({
    where: { clinic_id: id },
    include: { interpreter: { select: { id: true, name: true } } },
  });
  return updated.map((b) => b.interpreter);
}

export async function listInterpreterNotes(clinicId: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  return prisma.clinicInterpreterNote.findMany({
    where: { clinic_id: clinicId },
    orderBy: { created_at: "desc" },
  });
}

export async function createInterpreterNote(
  clinicId: string,
  body: CreateClinicInterpreterNoteBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  return prisma.clinicInterpreterNote.create({
    data: { clinic_id: clinicId, content: body.content, type: body.type },
  });
}

export async function updateInterpreterNote(
  clinicId: string,
  noteId: string,
  body: UpdateClinicInterpreterNoteBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  const note = await prisma.clinicInterpreterNote.findUnique({ where: { id: noteId } });
  if (!note || note.clinic_id !== clinicId) throw new NotFoundError("NOTE_NOT_FOUND", "Note not found");
  return prisma.clinicInterpreterNote.update({
    where: { id: noteId },
    data: {
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    },
  });
}

export async function deleteInterpreterNote(clinicId: string, noteId: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { organization_id: true } });
  ensureTenant(clinic, organizationId);
  const note = await prisma.clinicInterpreterNote.findUnique({ where: { id: noteId } });
  if (!note || note.clinic_id !== clinicId) throw new NotFoundError("NOTE_NOT_FOUND", "Note not found");
  await prisma.clinicInterpreterNote.delete({ where: { id: noteId } });
}

export async function deactivateClinic(id: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id } });
  ensureTenant(clinic, organizationId);

  const upcoming = await prisma.appointment.count({
    where: { clinic_id: id, status: { in: ["accepted", "in_progress"] }, date_time: { gte: new Date() } },
  });
  if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Clinic has upcoming accepted appointments");

  await prisma.clinic.update({ where: { id }, data: { is_active: false } });
}
