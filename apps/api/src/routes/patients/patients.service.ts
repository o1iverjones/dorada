import type { PrismaClient } from "@prisma/client";
import type { CreatePatientBody, UpdatePatientBody, PatientListQuery } from "@pulpito/types";
import { NotFoundError, ConflictError, ValidationError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("PATIENT_NOT_FOUND", "Patient not found");
  }
}

export async function listPatients(query: PatientListQuery, organizationId: string, prisma: PrismaClient) {
  const items = await prisma.patient.findMany({
    where: {
      organization_id: organizationId,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { mrn: { contains: query.search, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(query.language ? { preferred_language: query.language } : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { name: "asc" },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data,
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function getPatient(id: string, organizationId: string, prisma: PrismaClient) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  ensureTenant(patient, organizationId);
  return patient;
}

export async function createPatient(body: CreatePatientBody, organizationId: string, prisma: PrismaClient) {
  if (body.mrn) {
    const existing = await prisma.patient.findFirst({ where: { organization_id: organizationId, mrn: body.mrn } });
    if (existing) throw new ConflictError("MRN_ALREADY_EXISTS", "MRN already registered");
  }

  if (body.preferred_language) {
    const lang = await prisma.organizationLanguage.findFirst({
      where: { organization_id: organizationId, code: body.preferred_language, active: true },
    });
    if (!lang) throw new ValidationError("INVALID_LANGUAGE", "Language not active in this organization");
  }

  return prisma.patient.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      mrn: body.mrn ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      preferred_language: body.preferred_language ?? null,
    },
  });
}

export async function updatePatient(id: string, body: UpdatePatientBody, organizationId: string, prisma: PrismaClient) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  ensureTenant(patient, organizationId);

  return prisma.patient.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.mrn !== undefined ? { mrn: body.mrn } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.preferred_language !== undefined ? { preferred_language: body.preferred_language } : {}),
    },
  });
}
