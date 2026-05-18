import type { PrismaClient } from "@prisma/client";
import type { CreateInsuranceAgencyBody, UpdateInsuranceAgencyBody, InsuranceAgencyListQuery } from "@dorada/types";
import { NotFoundError, ConflictError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("AGENCY_NOT_FOUND", "Insurance agency not found");
  }
}

function formatAgency(a: {
  id: string; name: string; address: string | null; phone: string | null;
  primary_contact_name: string | null; primary_contact_phone: string | null; primary_contact_email: string | null;
  notes: string | null; is_active: boolean; created_at: Date; updated_at: Date;
  email_intake_enabled: boolean;
  email_intake_sender_domains: string[];
  email_intake_confirmation_override: string | null;
  email_intake_reply_template: string | null;
  email_intake_reply_from_name: string | null;
  email_intake_reply_from_email: string | null;
}) {
  return {
    id: a.id, name: a.name, address: a.address, phone: a.phone,
    primary_contact: a.primary_contact_name ? {
      name: a.primary_contact_name, phone: a.primary_contact_phone, email: a.primary_contact_email,
    } : null,
    notes: a.notes,
    email_intake: a.email_intake_enabled ? {
      sender_domains: a.email_intake_sender_domains,
      confirmation_method_override: a.email_intake_confirmation_override,
      reply_template: a.email_intake_reply_template,
      reply_from_name: a.email_intake_reply_from_name,
      reply_from_email: a.email_intake_reply_from_email,
    } : null,
    is_active: a.is_active,
    created_at: a.created_at.toISOString(),
    updated_at: a.updated_at.toISOString(),
  };
}

export async function listAgencies(query: InsuranceAgencyListQuery, organizationId: string, prisma: PrismaClient) {
  const items = await prisma.insuranceAgency.findMany({
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
    data: data.map(formatAgency),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function getAgency(id: string, organizationId: string, prisma: PrismaClient) {
  const agency = await prisma.insuranceAgency.findUnique({ where: { id } });
  ensureTenant(agency, organizationId);
  return formatAgency(agency!);
}

export async function createAgency(body: CreateInsuranceAgencyBody, organizationId: string, prisma: PrismaClient) {
  return prisma.insuranceAgency.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      address: body.address ?? null,
      phone: body.phone ?? null,
      primary_contact_name: body.primary_contact?.name ?? null,
      primary_contact_phone: body.primary_contact?.phone ?? null,
      primary_contact_email: body.primary_contact?.email ?? null,
      notes: body.notes ?? null,
      email_intake_enabled: !!body.email_intake,
      email_intake_sender_domains: body.email_intake?.sender_domains ?? [],
      email_intake_confirmation_override: body.email_intake?.confirmation_method_override ?? null,
      email_intake_reply_template: body.email_intake?.reply_template ?? null,
      email_intake_reply_from_name: body.email_intake?.reply_from_name ?? null,
      email_intake_reply_from_email: body.email_intake?.reply_from_email ?? null,
    },
  });
}

export async function updateAgency(id: string, body: UpdateInsuranceAgencyBody, organizationId: string, prisma: PrismaClient) {
  const agency = await prisma.insuranceAgency.findUnique({ where: { id } });
  ensureTenant(agency, organizationId);

  return prisma.insuranceAgency.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.email_intake !== undefined ? {
        email_intake_enabled: !!body.email_intake,
        email_intake_sender_domains: body.email_intake?.sender_domains ?? [],
        email_intake_confirmation_override: body.email_intake?.confirmation_method_override ?? null,
        email_intake_reply_template: body.email_intake?.reply_template ?? null,
        email_intake_reply_from_name: body.email_intake?.reply_from_name ?? null,
        email_intake_reply_from_email: body.email_intake?.reply_from_email ?? null,
      } : {}),
    },
  });
}

export async function deactivateAgency(id: string, organizationId: string, prisma: PrismaClient) {
  const agency = await prisma.insuranceAgency.findUnique({ where: { id } });
  ensureTenant(agency, organizationId);

  const upcoming = await prisma.appointment.count({
    where: { insurance_agency_id: id, status: { in: ["confirmed", "in_progress"] }, date_time: { gte: new Date() } },
  });
  if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Agency has upcoming confirmed appointments");

  await prisma.insuranceAgency.update({ where: { id }, data: { is_active: false } });
}
