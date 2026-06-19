import type { PrismaClient } from "@prisma/client";
import type { CreateCityBody, UpdateCityBody } from "@dorada/types";
import { NotFoundError, ConflictError } from "../../lib/errors.js";

function ensureTenant(record: { organization_id: string } | null, organizationId: string) {
  if (!record || record.organization_id !== organizationId) {
    throw new NotFoundError("CITY_NOT_FOUND", "City not found");
  }
}

export async function listCities(organizationId: string, prisma: PrismaClient) {
  const rows = await prisma.city.findMany({
    where: { organization_id: organizationId },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, created_at: c.created_at.toISOString() }));
}

export async function createCity(body: CreateCityBody, organizationId: string, prisma: PrismaClient) {
  const name = body.name.trim();
  const existing = await prisma.city.findUnique({
    where: { organization_id_name: { organization_id: organizationId, name } },
  });
  if (existing) throw new ConflictError("CITY_EXISTS", "A city with that name already exists");

  const city = await prisma.city.create({
    data: { organization_id: organizationId, name },
  });
  return { id: city.id, name: city.name, created_at: city.created_at.toISOString() };
}

export async function renameCity(
  id: string,
  body: UpdateCityBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const city = await prisma.city.findUnique({ where: { id } });
  ensureTenant(city, organizationId);

  const oldName = city!.name;
  const newName = body.name.trim();

  if (oldName === newName) return { id: city!.id, name: oldName, created_at: city!.created_at.toISOString() };

  const conflict = await prisma.city.findUnique({
    where: { organization_id_name: { organization_id: organizationId, name: newName } },
  });
  if (conflict) throw new ConflictError("CITY_EXISTS", "A city with that name already exists");

  // Update the city record and replace the old name in every interpreter's preferred_cities array
  const [updated] = await Promise.all([
    prisma.city.update({ where: { id }, data: { name: newName } }),
    prisma.$executeRaw`
      UPDATE interpreters
      SET preferred_cities = array_replace(preferred_cities, ${oldName}, ${newName})
      WHERE organization_id = ${organizationId}
        AND ${oldName} = ANY(preferred_cities)
    `,
  ]);

  return { id: updated.id, name: updated.name, created_at: updated.created_at.toISOString() };
}

export async function deleteCity(id: string, organizationId: string, prisma: PrismaClient) {
  const city = await prisma.city.findUnique({ where: { id } });
  ensureTenant(city, organizationId);

  const name = city!.name;

  // Remove the city from every interpreter's preferred_cities array, then delete
  await Promise.all([
    prisma.$executeRaw`
      UPDATE interpreters
      SET preferred_cities = array_remove(preferred_cities, ${name})
      WHERE organization_id = ${organizationId}
        AND ${name} = ANY(preferred_cities)
    `,
    prisma.city.delete({ where: { id } }),
  ]);
}
