import type { FastifyInstance } from "fastify";
import { AgencyListQuerySchema, CreateAgencyBodySchema, UpdateAgencyBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listAgencies, getAgency, createAgency, updateAgency, deactivateAgency } from "./agencies.service.js";
import { writeActivityLog } from "../../lib/activityLog.js";

export default async function agencyRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_clinics")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = AgencyListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listAgencies(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAgency(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreateAgencyBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const agency = await createAgency(body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "agency", entityId: agency.id, entityName: agency.name, action: "created", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(201).send(agency);
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateAgencyBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const agency = await updateAgency(id, body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "agency", entityId: id, entityName: agency.name, action: "updated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.send(agency);
  });

  fastify.delete("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const existing = await fastify.prisma.agency.findUnique({ where: { id }, select: { name: true } });
    await deactivateAgency(id, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "agency", entityId: id, entityName: existing?.name ?? null, action: "deactivated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(204).send();
  });
}
