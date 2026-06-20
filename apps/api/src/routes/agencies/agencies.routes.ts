import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AgencyListQuerySchema, CreateAgencyBodySchema, UpdateAgencyBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listAgencies, getAgency, createAgency, updateAgency, deactivateAgency, getAgencyActivity, getAgencyNotes, addAgencyNote } from "./agencies.service.js";
import { writeActivityLog } from "../../lib/activityLog.js";
import { uploadImage, imageFilename, ImageUploadError } from "../../lib/uploadImage.js";
import { noteImagePath } from "../../integrations/r2.js";

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

  fastify.get("/:id/activity", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAgencyActivity(id, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAgencyNotes(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content, image_url } = z.object({ content: z.string().max(800), image_url: z.string().url().nullish() }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = payload.name
      ? { id: payload.sub, name: payload.name }
      : { id: payload.sub, name: (await fastify.prisma.user.findUnique({ where: { id: payload.sub }, select: { name: true } }))?.name ?? "Admin" };
    return reply.status(201).send(await addAgencyNote(id, content, payload.organization_id, actor, fastify.prisma, image_url ?? null));
  });

  fastify.post("/:id/note-image", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    try {
      const filename = imageFilename(data.filename, data.mimetype);
      const url = await uploadImage(data, noteImagePath("agency", id, filename));
      return reply.send({ url });
    } catch (err) {
      if (err instanceof ImageUploadError) return reply.status(400).send({ error: { code: err.code, message: err.message } });
      throw err;
    }
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
