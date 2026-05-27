import type { PrismaClient } from "@prisma/client";
import type { CreatePatientBody, UpdatePatientBody, PatientListQuery } from "@dorada/types";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("PATIENT_NOT_FOUND", "Patient not found");
  }
}

const patientInclude = {
  preferred_interpreter: { select: { id: true, name: true } },
} as const;

export async function listPatients(query: PatientListQuery, organizationId: string, prisma: PrismaClient) {
  const where = {
    organization_id: organizationId,
    ...(query.search ? {
      OR: [
        { name: { contains: query.search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(query.language ? { preferred_language: query.language } : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: { name: "asc" },
      include: patientInclude,
    }),
  ]);

  const totalPages = Math.ceil(total / query.limit);
  return {
    data: items,
    pagination: { page: query.page, total_pages: totalPages, total, has_more: query.page < totalPages },
  };
}

export async function getPatient(id: string, organizationId: string, prisma: PrismaClient) {
  const patient = await prisma.patient.findUnique({ where: { id }, include: patientInclude });
  ensureTenant(patient, organizationId);
  return patient;
}

export async function createPatient(body: CreatePatientBody, organizationId: string, prisma: PrismaClient) {
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
      case_numbers: body.case_numbers ?? [],
      preferred_interpreter_id: body.preferred_interpreter_id ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      preferred_language: body.preferred_language ?? null,
    },
    include: patientInclude,
  });
}

export async function updatePatient(id: string, body: UpdatePatientBody, organizationId: string, prisma: PrismaClient) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  ensureTenant(patient, organizationId);

  return prisma.patient.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.date_of_birth !== undefined ? { date_of_birth: body.date_of_birth ? new Date(body.date_of_birth) : null } : {}),
      ...(body.case_numbers !== undefined ? { case_numbers: body.case_numbers } : {}),
      ...(body.preferred_interpreter_id !== undefined ? { preferred_interpreter_id: body.preferred_interpreter_id } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.preferred_language !== undefined ? { preferred_language: body.preferred_language } : {}),
    },
    include: patientInclude,
  });
}
