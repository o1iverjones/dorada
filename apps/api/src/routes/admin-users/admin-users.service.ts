import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NotFoundError, ConflictError, ForbiddenError } from "../../lib/errors.js";

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
  creatorPermissions: string[],
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

  // Roles that include manage_system_settings can only be assigned by Super Admins
  const targetRole = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: true },
  });
  if (!targetRole || targetRole.organization_id !== organizationId) {
    throw new NotFoundError("ROLE_NOT_FOUND", "Role not found");
  }
  const targetIsElevated = targetRole.permissions.some((p) => p.permission === "manage_system_settings");
  if (targetIsElevated && !creatorPermissions.includes("manage_system_settings")) {
    throw new ForbiddenError("FORBIDDEN", "Only Super Admins can assign the Super Admin role");
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

export async function updateUser(
  id: string,
  body: { name?: string; email?: string; password?: string; role_id?: string; is_active?: boolean },
  organizationId: string,
  actorPermissions: string[],
  prisma: PrismaClient,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: { include: { permissions: true } } },
  });
  if (!user || user.organization_id !== organizationId) throw new NotFoundError("NOT_FOUND", "User not found");

  // Non-super-admins cannot edit a Super Admin user
  const targetIsElevated = user.role.permissions.some((p) => p.permission === "manage_system_settings");
  if (targetIsElevated && !actorPermissions.includes("manage_system_settings")) {
    throw new ForbiddenError("FORBIDDEN", "Only Super Admins can edit Super Admin users");
  }

  if (body.role_id && body.role_id !== user.role_id) {
    const targetRole = await prisma.role.findUnique({ where: { id: body.role_id }, include: { permissions: true } });
    if (!targetRole || targetRole.organization_id !== organizationId) throw new NotFoundError("ROLE_NOT_FOUND", "Role not found");
    const newRoleElevated = targetRole.permissions.some((p) => p.permission === "manage_system_settings");
    if (newRoleElevated && !actorPermissions.includes("manage_system_settings")) {
      throw new ForbiddenError("FORBIDDEN", "Only Super Admins can assign the Super Admin role");
    }
  }

  if (body.email && body.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { organization_id_email: { organization_id: organizationId, email: body.email } },
    });
    if (existing) throw new ConflictError("EMAIL_TAKEN", "Email already in use");
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.email !== undefined) data.email = body.email;
  if (body.role_id !== undefined) data.role_id = body.role_id;
  if (body.is_active !== undefined) data.is_active = body.is_active;
  if (body.password) data.password_hash = await bcrypt.hash(body.password, 12);

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { role: true },
  });

  return { id: updated.id, name: updated.name, email: updated.email, is_active: updated.is_active, mfa_enabled: updated.mfa_enabled, role: { id: updated.role.id, name: updated.role.name } };
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

export async function deleteUser(
  id: string,
  actorId: string,
  organizationId: string,
  actorPermissions: string[],
  prisma: PrismaClient,
) {
  if (id === actorId) throw new ForbiddenError("CANNOT_DELETE_SELF", "You cannot delete your own account");

  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: { include: { permissions: true } } },
  });
  if (!user || user.organization_id !== organizationId) throw new NotFoundError("NOT_FOUND", "User not found");

  const targetIsElevated = user.role.permissions.some((p) => p.permission === "manage_system_settings");
  if (targetIsElevated && !actorPermissions.includes("manage_system_settings")) {
    throw new ForbiddenError("FORBIDDEN", "Only Super Admins can delete Super Admin users");
  }

  await prisma.$transaction([
    // Null out nullable FKs that have no cascade
    prisma.message.updateMany({ where: { sender_user_id: id }, data: { sender_user_id: null } }),
    prisma.invoice.updateMany({ where: { approved_by_id: id }, data: { approved_by_id: null } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return { id, name: user.name };
}
