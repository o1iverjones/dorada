import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listUsers, createUser, updateUser, listRoles, createRole } from "./admin-users.service.js";
import { writeActivityLog } from "../../lib/activityLog.js";
import { sendEmail, welcomeAdminEmail } from "../../lib/email.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

const CreateUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
  role_id: z.string().uuid().optional(),
});

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(10).optional(),
  role_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

const CreateRoleBody = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).default([]),
});

export default async function adminUsersRoutes(fastify: FastifyInstance) {
  const manage = [authenticateAdmin, requirePermission("manage_admin_users")];

  fastify.get("/admin-users", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listUsers(payload.organization_id, fastify.prisma));
  });

  fastify.post("/admin-users", { preHandler: manage }, async (req, reply) => {
    const body = CreateUserBody.parse(req.body);
    const payload = req.user as JwtPayload;
    const user = await createUser(body, payload.organization_id, payload.permissions, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "admin_user", entityId: user.id, entityName: user.name, action: "created", adminId: payload.sub, adminName: payload.name ?? "Admin" });

    // Send welcome email with login credentials (fire-and-forget — don't block response)
    const loginUrl = `${config.APP_URL}/login`;
    sendEmail(welcomeAdminEmail(user.name, user.email, body.password, loginUrl)).catch((err) => {
      logger.error({ err, userId: user.id }, "Failed to send welcome email to new admin user");
    });

    return reply.status(201).send(user);
  });

  fastify.patch("/admin-users/:id", { preHandler: manage }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateUserBody.parse(req.body);
    const payload = req.user as JwtPayload;
    const user = await updateUser(id, body, payload.organization_id, payload.permissions, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "admin_user", entityId: id, entityName: user.name, action: "updated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.send(user);
  });

  fastify.get("/roles", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listRoles(payload.organization_id, fastify.prisma));
  });

  fastify.post("/roles", { preHandler: manage }, async (req, reply) => {
    const body = CreateRoleBody.parse(req.body);
    const payload = req.user as JwtPayload;
    const role = await createRole(body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "admin_user", entityId: role.id, entityName: role.name, action: "role_created", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(201).send(role);
  });
}
