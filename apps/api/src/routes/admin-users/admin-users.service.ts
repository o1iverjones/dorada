import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NotFoundError, ConflictError } from "../../lib/errors.js";

export async function listUsers(organizationId: string, prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: { organization_id: organizationId },
    include: { role: { include: { permissions: true } } },
    orderBy: { name: "asc" },
  });
  return {
    data: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      is_active: u.is_active,
      mfa_enabled: u.mfa_enabled,
      role: { id: u.role.id, name: u.role.name },
    })),
  };
}

export async function createUser(
  body: { name: string; email: string; password: string; role_id?: string },
  organizationId: string,
  prisma: PrismaClient,
) {
  const existing = await prisma.user.findUnique({
    where: { organization_id_email: { organization_id: organizationId, email: body.email } },
  });
  if (existing) throw new ConflictError("EMAIL_TAKEN", "Email already in use");

  let roleId = body.role_id;
  if (!roleId) {
    const defaultRole = await prisma.role.findFirst({ where: { organization_id: organizationId }, orderBy: { created_at: "asc" } });
    if (!defaultRole) throw new NotFoundError("NO_ROLE", "No roles found — create a role first");
    roleId = defaultRole.id;
  }

  const password_hash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: { organization_id: organizationId, name: body.name, email: body.email, password_hash, role_id: roleId },
    include: { role: true },
  });

  return { id: user.id, name: user.name, email: user.email, is_active: user.is_active, mfa_enabled: user.mfa_enabled, role: { id: user.role.id, name: user.role.name } };
}

export async function listRoles(organizationId: string, prisma: PrismaClient) {
  const roles = await prisma.role.findMany({
    where: { organization_id: organizationId },
    include: { permissions: true },
    orderBy: { name: "asc" },
  });
  return {
    data: roles.map((r) => ({
      id: r.id,
      name: r.name,
      is_system: r.is_system,
      permissions: r.permissions.map((p) => p.permission),
    })),
  };
}

export async function createRole(
  body: { name: string; permissions: string[] },
  organizationId: string,
  prisma: PrismaClient,
) {
  const existing = await prisma.role.findUnique({
    where: { organization_id_name: { organization_id: organizationId, name: body.name } },
  });
  if (existing) throw new ConflictError("ROLE_NAME_TAKEN", "A role with that name already exists");

  const role = await prisma.role.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      permissions: { create: body.permissions.map((p) => ({ permission: p as never })) },
    },
    include: { permissions: true },
  });

  return { id: role.id, name: role.name, is_system: role.is_system, permissions: role.permissions.map((p) => p.permission) };
}
