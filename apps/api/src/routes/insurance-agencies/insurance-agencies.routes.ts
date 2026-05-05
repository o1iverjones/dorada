import type { FastifyInstance } from "fastify";
import { InsuranceAgencyListQuerySchema, CreateInsuranceAgencyBodySchema, UpdateInsuranceAgencyBodySchema } from "@pulpito/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listAgencies, getAgency, createAgency, updateAgency, deactivateAgency } from "./insurance-agencies.service.js";

export default async function insuranceAgencyRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_clinics")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = InsuranceAgencyListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listAgencies(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAgency(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreateInsuranceAgencyBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createAgency(body, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateInsuranceAgencyBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateAgency(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deactivateAgency(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });
}
