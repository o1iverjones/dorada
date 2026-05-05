import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listUsers, createUser, listRoles, createRole } from "./admin-users.service.js";

const CreateUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
  role_id: z.string().uuid().optional(),
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
    return reply.status(201).send(await createUser(body, payload.organization_id, fastify.prisma));
  });

  fastify.get("/roles", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listRoles(payload.organization_id, fastify.prisma));
  });

  fastify.post("/roles", { preHandler: manage }, async (req, reply) => {
    const body = CreateRoleBody.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createRole(body, payload.organization_id, fastify.prisma));
  });
}
