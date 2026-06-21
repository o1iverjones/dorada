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
  fax: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    fax: c.fax,
    email: c.email,
    address: c.address,
    city: c.city,
    state: c.state,
    zip_code: c.zip_code,
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
      fax: body.fax ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip_code: body.zip_code ?? null,
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
      ...(body.fax !== undefined ? { fax: body.fax ?? null } : {}),
      ...(body.email !== undefined ? { email: body.email ?? null } : {}),
      ...(body.address !== undefined ? { address: body.address ?? null } : {}),
      ...(body.city !== undefined ? { city: body.city ?? null } : {}),
      ...(body.state !== undefined ? { state: body.state ?? null } : {}),
      ...(body.zip_code !== undefined ? { zip_code: body.zip_code ?? null } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    },
  });
  return formatCompany(updated);
}

