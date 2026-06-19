import type { PrismaClient } from "@prisma/client";
import type {
  CreateInterpreterBody,
  UpdateInterpreterBody,
  UpdateSelfInterpreterBody,
  CreateAvailabilityBlockBody,
  InterpreterListQuery,
} from "@dorada/types";
import { NotFoundError, ConflictError, ValidationError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string, code: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError(code, "Interpreter not found");
  }
}

export async function listInterpreters(query: InterpreterListQuery, organizationId: string, prisma: PrismaClient) {
  const checkDate = query.check_availability_on ? new Date(query.check_availability_on) : null;

  const items = await prisma.interpreter.findMany({
    where: {
      organization_id: organizationId,
      ...(query.include_inactive ? {} : { is_active: true }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.language ? { languages: { has: query.language } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.clinic_id ? { clinics_not_allowed: { none: { clinic_id: query.clinic_id } } } : {}),
      ...(query.available_on
        ? {
            availability_blocks: {
              none: { from: { lte: new Date(query.available_on) }, to: { gte: new Date(query.available_on) } },
            },
          }
        : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { name: "asc" },
    include: {
      clinics_not_allowed: { include: { clinic: { select: { id: true, name: true } } } },
      ...(checkDate
        ? {
            availability_blocks: {
              where: { from: { lte: checkDate }, to: { gte: checkDate } },
              select: { id: true },
            },
          }
        : {}),
    },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data: data.map((i) => ({
      ...formatInterpreter(i),
      ...(checkDate ? { is_available: (i as typeof i & { availability_blocks?: { id: string }[] }).availability_blocks?.length === 0 } : {}),
    })),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

function formatInterpreter(i: {
  id: string; name: string; phone: string; email: string | null; type: string;
  languages: string[]; profile_picture_url: string | null; location_lat: number | null;
  location_lng: number | null; pay_rate: unknown; pay_rate_certified?: unknown; payment_method: string | null; is_active: boolean;
  created_at: Date; updated_at: Date;
  clinics_not_allowed: { clinic: { id: string; name: string } }[];
  address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null;
  emergency_contact_name?: string | null; emergency_contact_phone?: string | null;
  notes?: string | null; certificate_number?: string | null; certificate_date?: Date | null; zip_code?: string | null; preferred_cities?: string[];
}) {
  return {
    id: i.id,
    name: i.name,
    phone: i.phone,
    email: i.email,
    type: i.type,
    languages: i.languages,
    profile_picture_url: i.profile_picture_url,
    location: i.location_lat != null && i.location_lng != null ? { lat: i.location_lat, lng: i.location_lng } : null,
    pay_rate: i.pay_rate ? Number(i.pay_rate) : null,
    pay_rate_certified: i.pay_rate_certified ? Number(i.pay_rate_certified) : null,
    payment_method: i.payment_method,
    is_active: i.is_active,
    clinics_not_allowed: i.clinics_not_allowed.map((b) => b.clinic),
    created_at: i.created_at.toISOString(),
    updated_at: i.updated_at.toISOString(),
    ...(i.address_line1 !== undefined ? { address_line1: i.address_line1 } : {}),
    ...(i.address_line2 !== undefined ? { address_line2: i.address_line2 } : {}),
    ...(i.city !== undefined ? { city: i.city } : {}),
    ...(i.state !== undefined ? { state: i.state } : {}),
    ...(i.emergency_contact_name !== undefined
      ? { emergency_contact: { name: i.emergency_contact_name, phone: i.emergency_contact_phone } }
      : {}),
    ...(i.notes !== undefined ? { notes: i.notes } : {}),
    ...(i.certificate_number !== undefined ? { certificate_number: i.certificate_number } : {}),
    ...(i.certificate_date !== undefined ? { certificate_date: i.certificate_date ? i.certificate_date.toISOString().slice(0, 10) : null } : {}),
    ...(i.zip_code !== undefined ? { zip_code: i.zip_code } : {}),
    ...(i.preferred_cities !== undefined ? { preferred_cities: i.preferred_cities } : {}),
  };
}

export async function getInterpreter(id: string, organizationId: string, prisma: PrismaClient) {
  const interpreter = await prisma.interpreter.findUnique({
    where: { id },
    include: {
      clinics_not_allowed: { include: { clinic: { select: { id: true, name: true } } } },
      availability_blocks: { orderBy: { from: "asc" } },
    },
  });
  ensureTenant(interpreter, organizationId, "INTERPRETER_NOT_FOUND");
  return formatInterpreter({ ...interpreter!, address_line1: interpreter!.address_line1, address_line2: interpreter!.address_line2, city: interpreter!.city, state: interpreter!.state, emergency_contact_name: interpreter!.emergency_contact_name, emergency_contact_phone: interpreter!.emergency_contact_phone, notes: interpreter!.notes, certificate_number: interpreter!.certificate_number, certificate_date: interpreter!.certificate_date, zip_code: interpreter!.zip_code, preferred_cities: interpreter!.preferred_cities });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function createInterpreter(body: CreateInterpreterBody, organizationId: string, prisma: PrismaClient) {
  const phone = normalizePhone(body.phone);
  const existing = await prisma.interpreter.findFirst({ where: { organization_id: organizationId, phone } });
  if (existing) throw new ConflictError("PHONE_ALREADY_EXISTS", "Phone number already registered");

  const settings = await prisma.systemSettings.findUnique({ where: { organization_id: organizationId } });
  const defaultRateQualified = Number(settings?.default_pay_rate_qualified ?? 30);
  const defaultRateCertified = Number(settings?.default_pay_rate_certified ?? 40);
  const defaultRate = body.type === "certified" || body.type === "qualified_and_certified"
    ? defaultRateCertified
    : defaultRateQualified;

  return prisma.interpreter.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      phone,
      email: body.email ?? null,
      type: body.type,
      languages: body.languages,
      location_lat: body.location?.lat ?? null,
      location_lng: body.location?.lng ?? null,
      pay_rate: body.pay_rate ?? defaultRate,
      pay_rate_certified: (body as Record<string, unknown>).pay_rate_certified != null ? Number((body as Record<string, unknown>).pay_rate_certified) : null,
      payment_method: body.payment_method ?? null,
      address_line1: body.address_line1 ?? null,
      address_line2: body.address_line2 ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      emergency_contact_name: body.emergency_contact?.name ?? null,
      emergency_contact_phone: body.emergency_contact?.phone ?? null,
      notes: body.notes ?? null,
      certificate_number: body.certificate_number ?? null,
      certificate_date: (body as Record<string, unknown>).certificate_date ? new Date((body as Record<string, unknown>).certificate_date as string) : null,
      zip_code: body.zip_code ?? null,
      preferred_cities: body.preferred_cities ?? [],
      ...(body.clinics_not_allowed?.length
        ? { clinics_not_allowed: { create: body.clinics_not_allowed.map((id) => ({ clinic_id: id })) } }
        : {}),
    },
    include: { clinics_not_allowed: { include: { clinic: { select: { id: true, name: true } } } } },
  });
}

export async function updateInterpreter(
  id: string,
  body: UpdateInterpreterBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const interpreter = await prisma.interpreter.findUnique({ where: { id } });
  ensureTenant(interpreter, organizationId, "INTERPRETER_NOT_FOUND");

  if (body.clinics_not_allowed !== undefined) {
    await prisma.clinicInterpreterBlock.deleteMany({ where: { interpreter_id: id } });
    if (body.clinics_not_allowed.length > 0) {
      await prisma.clinicInterpreterBlock.createMany({
        data: body.clinics_not_allowed.map((clinicId) => ({ clinic_id: clinicId, interpreter_id: id })),
      });
    }
  }

  return prisma.interpreter.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.phone ? { phone: normalizePhone(body.phone) } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.type ? { type: body.type } : {}),
      ...(body.languages ? { languages: body.languages } : {}),
      ...(body.location ? { location_lat: body.location.lat, location_lng: body.location.lng } : {}),
      ...(body.pay_rate !== undefined ? { pay_rate: body.pay_rate } : {}),
      ...((body as Record<string, unknown>).pay_rate_certified !== undefined ? { pay_rate_certified: (body as Record<string, unknown>).pay_rate_certified != null ? Number((body as Record<string, unknown>).pay_rate_certified) : null } : {}),
      ...(body.payment_method !== undefined ? { payment_method: body.payment_method } : {}),
      ...(body.address_line1 !== undefined ? { address_line1: body.address_line1 } : {}),
      ...(body.address_line2 !== undefined ? { address_line2: body.address_line2 } : {}),
      ...(body.city !== undefined ? { city: body.city } : {}),
      ...(body.state !== undefined ? { state: body.state } : {}),
      ...(body.emergency_contact
        ? { emergency_contact_name: body.emergency_contact.name, emergency_contact_phone: body.emergency_contact.phone }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.certificate_number !== undefined ? { certificate_number: body.certificate_number } : {}),
      ...((body as Record<string, unknown>).certificate_date !== undefined ? { certificate_date: (body as Record<string, unknown>).certificate_date ? new Date((body as Record<string, unknown>).certificate_date as string) : null } : {}),
      ...(body.zip_code !== undefined ? { zip_code: body.zip_code } : {}),
      ...(body.preferred_cities !== undefined ? { preferred_cities: body.preferred_cities } : {}),
    },
    include: { clinics_not_allowed: { include: { clinic: { select: { id: true, name: true } } } } },
  });
}

export async function deactivateInterpreter(id: string, organizationId: string, prisma: PrismaClient) {
  const interpreter = await prisma.interpreter.findUnique({ where: { id } });
  ensureTenant(interpreter, organizationId, "INTERPRETER_NOT_FOUND");

  const upcoming = await prisma.appointment.count({
    where: { interpreter_id: id, status: { in: ["accepted", "in_progress"] }, date_time: { gte: new Date() } },
  });
  if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Interpreter has upcoming accepted appointments");

  await prisma.interpreter.update({ where: { id }, data: { is_active: false } });
}

export async function updateSelf(interpreterId: string, body: UpdateSelfInterpreterBody, prisma: PrismaClient) {
  return prisma.interpreter.update({
    where: { id: interpreterId },
    data: {
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.location ? { location_lat: body.location.lat, location_lng: body.location.lng } : {}),
      ...(body.fcm_token !== undefined ? { fcm_token: body.fcm_token } : {}),
    },
  });
}

export async function listAvailabilityBlocks(interpreterId: string, prisma: PrismaClient) {
  const blocks = await prisma.availabilityBlock.findMany({
    where: { interpreter_id: interpreterId },
    orderBy: { from: "asc" },
  });
  return { data: blocks };
}

export async function listAllAvailabilityBlocks(
  organizationId: string,
  dateFrom: string,
  dateTo: string,
  interpreterId: string | undefined,
  prisma: PrismaClient,
) {
  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      interpreter: { organization_id: organizationId },
      ...(interpreterId ? { interpreter_id: interpreterId } : {}),
      from: { lte: new Date(dateTo + "T23:59:59Z") },
      to: { gte: new Date(dateFrom) },
    },
    include: { interpreter: { select: { id: true, name: true } } },
    orderBy: { from: "asc" },
  });
  return { data: blocks };
}

export async function createAvailabilityBlock(
  interpreterId: string,
  body: CreateAvailabilityBlockBody,
  prisma: PrismaClient,
) {
  if (new Date(body.from) >= new Date(body.to)) {
    throw new ValidationError("INVALID_DATE_RANGE", "to must be after from");
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      interpreter_id: interpreterId,
      status: { in: ["accepted", "in_progress"] },
      date_time: { gte: new Date(body.from), lte: new Date(body.to) },
    },
  });
  if (conflict) {
    throw new ConflictError("AVAILABILITY_CONFLICTS_WITH_APPOINTMENT", "Block overlaps an accepted appointment");
  }

  return prisma.availabilityBlock.create({
    data: {
      interpreter_id: interpreterId,
      from: new Date(body.from),
      to: new Date(body.to),
      reason: body.reason ?? null,
    },
  });
}

export async function deleteAvailabilityBlock(
  interpreterId: string,
  blockId: string,
  prisma: PrismaClient,
) {
  const block = await prisma.availabilityBlock.findUnique({ where: { id: blockId } });
  if (!block || block.interpreter_id !== interpreterId) {
    throw new NotFoundError("INTERPRETER_NOT_FOUND", "Availability block not found");
  }
  await prisma.availabilityBlock.delete({ where: { id: blockId } });
}
