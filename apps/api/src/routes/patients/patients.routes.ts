import type { FastifyInstance } from "fastify";
import { PatientListQuerySchema, CreatePatientBodySchema, UpdatePatientBodySchema, CreateClaimBodySchema, UpdateClaimBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listPatients, getPatient, createPatient, updatePatient, createClaim, updateClaim, deleteClaim } from "./patients.service.js";

export default async function patientRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_appointments")];

  // ─── Patients ────────────────────────────────────────────────────────────────

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = PatientListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listPatients(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getPatient(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreatePatientBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createPatient(body, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdatePatientBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updatePatient(id, body, payload.organization_id, fastify.prisma));
  });

  // ─── Claims ──────────────────────────────────────────────────────────────────

  fastify.post("/:id/claims", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = CreateClaimBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createClaim(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/:id/claims/:claimId", { preHandler }, async (req, reply) => {
    const { id, claimId } = req.params as { id: string; claimId: string };
    const body = UpdateClaimBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateClaim(id, claimId, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/:id/claims/:claimId", { preHandler }, async (req, reply) => {
    const { id, claimId } = req.params as { id: string; claimId: string };
    const payload = req.user as JwtPayload;
    await deleteClaim(id, claimId, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });
}
