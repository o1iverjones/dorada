import type { FastifyInstance } from "fastify";
import { ClinicListQuerySchema, CreateClinicBodySchema, UpdateClinicBodySchema } from "@pulpito/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listClinics, getClinic, createClinic, updateClinic, deactivateClinic } from "./clinics.service.js";

export default async function clinicRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_clinics")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = ClinicListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listClinics(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getClinic(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreateClinicBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createClinic(body, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateClinicBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateClinic(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deactivateClinic(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });
}
