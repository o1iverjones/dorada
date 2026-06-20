import type { PrismaClient } from "@prisma/client";
import type { CreateAgencyBody, UpdateAgencyBody, AgencyListQuery } from "@dorada/types";
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
  contact_method: string | null; telephone: string | null; id_number: string | null;
  rate_qualified: unknown; rate_certified: unknown; rate_qme: unknown; miles: unknown;
  reporting_info: string | null; reporting_contact: string | null;
  followup_info: string | null; followup_contact: string | null;
  invoice_info: string | null; invoice_contact: string | null;
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
    contact_method: a.contact_method,
    telephone: a.telephone,
    id_number: a.id_number,
    rate_qualified: a.rate_qualified != null ? Number(a.rate_qualified) : null,
    rate_certified: a.rate_certified != null ? Number(a.rate_certified) : null,
    rate_qme: a.rate_qme != null ? Number(a.rate_qme) : null,
    miles: a.miles != null ? Number(a.miles) : null,
    reporting_info: a.reporting_info,
    reporting_contact: a.reporting_contact,
    followup_info: a.followup_info,
    followup_contact: a.followup_contact,
    invoice_info: a.invoice_info,
    invoice_contact: a.invoice_contact,
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

export async function listAgencies(query: AgencyListQuery, organizationId: string, prisma: PrismaClient) {
  const items = await prisma.agency.findMany({
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
  const agency = await prisma.agency.findUnique({ where: { id } });
  ensureTenant(agency, organizationId);
  return formatAgency(agency!);
}

export async function createAgency(body: CreateAgencyBody, organizationId: string, prisma: PrismaClient) {
  return prisma.agency.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      address: body.address ?? null,
      phone: body.phone ?? null,
      primary_contact_name: body.primary_contact?.name ?? null,
      primary_contact_phone: body.primary_contact?.phone ?? null,
      primary_contact_email: body.primary_contact?.email ?? null,
      notes: body.notes ?? null,
      contact_method: body.contact_method ?? null,
      telephone: body.telephone ?? null,
      id_number: body.id_number ?? null,
      rate_qualified: body.rate_qualified ?? null,
      rate_certified: body.rate_certified ?? null,
      rate_qme: body.rate_qme ?? null,
      miles: body.miles ?? null,
      reporting_info: body.reporting_info ?? null,
      reporting_contact: body.reporting_contact ?? null,
      followup_info: body.followup_info ?? null,
      followup_contact: body.followup_contact ?? null,
      invoice_info: body.invoice_info ?? null,
      invoice_contact: body.invoice_contact ?? null,
      email_intake_enabled: !!body.email_intake,
      email_intake_sender_domains: body.email_intake?.sender_domains ?? [],
      email_intake_confirmation_override: body.email_intake?.confirmation_method_override ?? null,
      email_intake_reply_template: body.email_intake?.reply_template ?? null,
      email_intake_reply_from_name: body.email_intake?.reply_from_name ?? null,
      email_intake_reply_from_email: body.email_intake?.reply_from_email ?? null,
    },
  });
}

export async function updateAgency(id: string, body: UpdateAgencyBody, organizationId: string, prisma: PrismaClient) {
  const agency = await prisma.agency.findUnique({ where: { id } });
  ensureTenant(agency, organizationId);

  if (body.is_active === false) {
    const upcoming = await prisma.appointment.count({
      where: { agency_id: id, status: { in: ["accepted", "in_progress"] }, date_time: { gte: new Date() } },
    });
    if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Agency has upcoming accepted appointments");
  }

  return prisma.agency.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.contact_method !== undefined ? { contact_method: body.contact_method } : {}),
      ...(body.telephone !== undefined ? { telephone: body.telephone } : {}),
      ...(body.id_number !== undefined ? { id_number: body.id_number } : {}),
      ...(body.rate_qualified !== undefined ? { rate_qualified: body.rate_qualified } : {}),
      ...(body.rate_certified !== undefined ? { rate_certified: body.rate_certified } : {}),
      ...(body.rate_qme !== undefined ? { rate_qme: body.rate_qme } : {}),
      ...(body.miles !== undefined ? { miles: body.miles } : {}),
      ...(body.reporting_info !== undefined ? { reporting_info: body.reporting_info } : {}),
      ...(body.reporting_contact !== undefined ? { reporting_contact: body.reporting_contact } : {}),
      ...(body.followup_info !== undefined ? { followup_info: body.followup_info } : {}),
      ...(body.followup_contact !== undefined ? { followup_contact: body.followup_contact } : {}),
      ...(body.invoice_info !== undefined ? { invoice_info: body.invoice_info } : {}),
      ...(body.invoice_contact !== undefined ? { invoice_contact: body.invoice_contact } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
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

export async function getAgencyNotes(id: string, organizationId: string, prisma: PrismaClient) {
  const agency = await prisma.agency.findUnique({ where: { id }, select: { organization_id: true } });
  ensureTenant(agency, organizationId);
  return prisma.agencyNote.findMany({
    where: { agency_id: id },
    orderBy: { created_at: "desc" },
  });
}

export async function addAgencyNote(
  id: string,
  content: string,
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
  imageUrl: string | null = null,
) {
  const agency = await prisma.agency.findUnique({ where: { id }, select: { organization_id: true, name: true } });
  ensureTenant(agency, organizationId);
  return prisma.agencyNote.create({
    data: { agency_id: id, organization_id: organizationId, content, admin_id: actor.id, admin_name: actor.name, image_url: imageUrl },
  });
}

export async function deactivateAgency(id: string, organizationId: string, prisma: PrismaClient) {
  const agency = await prisma.agency.findUnique({ where: { id } });
  ensureTenant(agency, organizationId);

  const upcoming = await prisma.appointment.count({
    where: { agency_id: id, status: { in: ["accepted", "in_progress"] }, date_time: { gte: new Date() } },
  });
  if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Agency has upcoming accepted appointments");

  await prisma.agency.update({ where: { id }, data: { is_active: false } });
}
