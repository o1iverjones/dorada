import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PatientListQuerySchema, CreatePatientBodySchema, UpdatePatientBodySchema, CreateClaimBodySchema, UpdateClaimBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { uploadImage, imageFilename, ImageUploadError } from "../../lib/uploadImage.js";
import { noteImagePath } from "../../integrations/r2.js";
import { listPatients, getPatient, createPatient, updatePatient, createClaim, updateClaim, deleteClaim, getPatientActivity, getPatientNotes, addPatientNote } from "./patients.service.js";

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

  fastify.get("/:id/activity", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getPatientActivity(id, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getPatientNotes(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content, image_url } = z.object({ content: z.string().max(800), image_url: z.string().url().nullish() }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = payload.name
      ? { id: payload.sub, name: payload.name }
      : { id: payload.sub, name: (await fastify.prisma.user.findUnique({ where: { id: payload.sub }, select: { name: true } }))?.name ?? "Admin" };
    return reply.status(201).send(await addPatientNote(id, content, payload.organization_id, actor, fastify.prisma, image_url ?? null));
  });

  fastify.post("/:id/note-image", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    try {
      const filename = imageFilename(data.filename, data.mimetype);
      const url = await uploadImage(data, noteImagePath("patient", id, filename));
      return reply.send({ url });
    } catch (err) {
      if (err instanceof ImageUploadError) return reply.status(400).send({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });
}
