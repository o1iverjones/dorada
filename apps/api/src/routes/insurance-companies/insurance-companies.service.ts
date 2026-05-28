import type { PrismaClient } from "@prisma/client";
import type { CreateInsuranceCompanyBody, UpdateInsuranceCompanyBody, InsuranceCompanyListQuery } from "@dorada/types";
import { NotFoundError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string, label = "Insurance company") {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("INSURANCE_COMPANY_NOT_FOUND", `${label} not found`);
  }
}

function formatCompany(c: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    is_active: c.is_active,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}

export async function listInsuranceCompanies(
  query: InsuranceCompanyListQuery,
  organizationId: string,
  prisma: PrismaClient,
) {
  const items = await prisma.insuranceCompany.findMany({
    where: {
      organization_id: organizationId,
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { name: "asc" },
  });

  const hasMore = items.length > query.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return {
    data: data.map(formatCompany),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function getInsuranceCompany(id: string, organizationId: string, prisma: PrismaClient) {
  const company = await prisma.insuranceCompany.findUnique({ where: { id } });
  ensureTenant(company, organizationId);
  return formatCompany(company!);
}

export async function createInsuranceCompany(
  body: CreateInsuranceCompanyBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const company = await prisma.insuranceCompany.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
    },
  });
  return formatCompany(company);
}

export async function updateInsuranceCompany(
  id: string,
  body: UpdateInsuranceCompanyBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const company = await prisma.insuranceCompany.findUnique({ where: { id } });
  ensureTenant(company, organizationId);

  const updated = await prisma.insuranceCompany.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
      ...(body.email !== undefined ? { email: body.email ?? null } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    },
  });
  return formatCompany(updated);
}

export async function getInsuranceCompanyActivity(id: string, organizationId: string, prisma: PrismaClient) {
  const company = await prisma.insuranceCompany.findUnique({ where: { id }, select: { organization_id: true } });
  ensureTenant(company, organizationId);
  return prisma.activityLog.findMany({
    where: { entity_type: "insurance_company", entity_id: id, organization_id: organizationId },
    orderBy: { created_at: "desc" },
  });
}
