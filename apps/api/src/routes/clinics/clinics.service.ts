import type { PrismaClient } from "@prisma/client";
import type { CreateClinicBody, UpdateClinicBody, ClinicListQuery } from "@pulpito/types";
import { NotFoundError, ConflictError, ValidationError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("CLINIC_NOT_FOUND", "Clinic not found");
  }
}

export async function listClinics(query: ClinicListQuery, organizationId: string, prisma: PrismaClient) {
  const items = await prisma.clinic.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
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
  id: string; name: string; address: string | null; phone: string | null;
  primary_contact_name: string | null; primary_contact_phone: string | null; primary_contact_email: string | null;
  billing_model: string; billing_hourly_rate: unknown; billing_flat_rate: unknown;
  billing_invoice_cycle: string; is_active: boolean; created_at: Date; updated_at: Date;
}) {
  return {
    id: c.id, name: c.name, address: c.address, phone: c.phone,
    primary_contact: c.primary_contact_name ? {
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
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}

export async function getClinic(id: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
    include: { interpreters_blocked: { include: { interpreter: { select: { id: true, name: true } } } } },
  });
  ensureTenant(clinic, organizationId);
  return {
    ...formatClinic(clinic!),
    interpreters_not_allowed: clinic!.interpreters_blocked.map((b) => b.interpreter),
  };
}

export async function createClinic(body: CreateClinicBody, organizationId: string, prisma: PrismaClient) {
  validateBilling(body.billing);
  return prisma.clinic.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      address: body.address ?? null,
      phone: body.phone ?? null,
      primary_contact_name: body.primary_contact?.name ?? null,
      primary_contact_phone: body.primary_contact?.phone ?? null,
      primary_contact_email: body.primary_contact?.email ?? null,
      billing_model: body.billing.model,
      billing_hourly_rate: body.billing.hourly_rate ?? null,
      billing_flat_rate: body.billing.flat_rate ?? null,
      billing_invoice_cycle: body.billing.invoice_cycle,
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

  return prisma.clinic.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.primary_contact
        ? { primary_contact_name: body.primary_contact.name, primary_contact_phone: body.primary_contact.phone ?? null, primary_contact_email: body.primary_contact.email ?? null }
        : {}),
      ...(body.billing ? { billing_model: body.billing.model, billing_hourly_rate: body.billing.hourly_rate ?? null, billing_flat_rate: body.billing.flat_rate ?? null, billing_invoice_cycle: body.billing.invoice_cycle } : {}),
    },
  });
}

export async function deactivateClinic(id: string, organizationId: string, prisma: PrismaClient) {
  const clinic = await prisma.clinic.findUnique({ where: { id } });
  ensureTenant(clinic, organizationId);

  const upcoming = await prisma.appointment.count({
    where: { clinic_id: id, status: { in: ["confirmed", "in_progress"] }, date_time: { gte: new Date() } },
  });
  if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Clinic has upcoming confirmed appointments");

  await prisma.clinic.update({ where: { id }, data: { is_active: false } });
}
