import type { FastifyInstance } from "fastify";
import { writeFile } from "fs/promises";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import {
  InterpreterListQuerySchema,
  CreateInterpreterBodySchema,
  UpdateInterpreterBodySchema,
  UpdateSelfInterpreterBodySchema,
  CreateAvailabilityBlockBodySchema,
} from "@dorada/types";
import { authenticateAdmin, authenticateInterpreter } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import {
  listInterpreters, getInterpreter, createInterpreter, updateInterpreter,
  deactivateInterpreter, reactivateInterpreter, updateSelf, listAvailabilityBlocks, listAllAvailabilityBlocks,
  createAvailabilityBlock, deleteAvailabilityBlock,
  getInterpreterActivity, getInterpreterNotes, addInterpreterNote,
} from "./interpreters.service.js";
import { writeActivityLog } from "../../lib/activityLog.js";
import { z } from "zod";
import { uploadImage, imageFilename, ImageUploadError } from "../../lib/uploadImage.js";
import { noteImagePath } from "../../integrations/r2.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "..", "..", "..", "uploads");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function interpreterRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const query = InterpreterListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listInterpreters(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/me", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreter(payload.sub, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/me", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const body = UpdateSelfInterpreterBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateSelf(payload.sub, body, fastify.prisma));
  });

  fastify.get("/me/availability", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listAvailabilityBlocks(payload.sub, fastify.prisma));
  });

  fastify.post("/me/availability", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const body = CreateAvailabilityBlockBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createAvailabilityBlock(payload.sub, body, fastify.prisma));
  });

  fastify.delete("/me/availability/:block_id", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { block_id } = req.params as { block_id: string };
    const payload = req.user as JwtPayload;
    await deleteAvailabilityBlock(payload.sub, block_id, fastify.prisma);
    return reply.status(204).send();
  });

  // Also expose interpreter's own appointments here for mobile
  fastify.get("/me/appointments", { preHandler: authenticateInterpreter }, async (req, reply) => {
    return reply.redirect("/api/v1/appointments/me/appointments");
  });

  fastify.get("/availability-blocks", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { date_from, date_to, interpreter_id } = req.query as { date_from: string; date_to: string; interpreter_id?: string };
    const payload = req.user as JwtPayload;
    return reply.send(await listAllAvailabilityBlocks(payload.organization_id, date_from, date_to, interpreter_id, fastify.prisma));
  });

  fastify.get("/cities", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    const rows = await fastify.prisma.city.findMany({
      where: { organization_id: payload.organization_id },
      orderBy: { name: "asc" },
      select: { name: true },
    });
    return reply.send(rows.map((r) => r.name));
  });

  fastify.get("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreter(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const body = CreateInterpreterBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const interpreter = await createInterpreter(body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "interpreter", entityId: interpreter.id, entityName: interpreter.name, action: "created", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(201).send(interpreter);
  });

  fastify.patch("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateInterpreterBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const interpreter = await updateInterpreter(id, body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "interpreter", entityId: id, entityName: interpreter.name, action: "updated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.send(interpreter);
  });

  fastify.delete("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const existing = await fastify.prisma.interpreter.findUnique({ where: { id }, select: { name: true } });
    await deactivateInterpreter(id, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "interpreter", entityId: id, entityName: existing?.name ?? null, action: "deactivated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(204).send();
  });

  fastify.post("/:id/reactivate", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const existing = await fastify.prisma.interpreter.findUnique({ where: { id }, select: { name: true } });
    await reactivateInterpreter(id, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "interpreter", entityId: id, entityName: existing?.name ?? null, action: "reactivated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.send({});
  });

  fastify.get("/:id/activity", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreterActivity(id, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id/admin-notes", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreterNotes(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/admin-notes", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content, image_url } = z.object({ content: z.string().max(800), image_url: z.string().url().nullish() }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = payload.name
      ? { id: payload.sub, name: payload.name }
      : { id: payload.sub, name: (await fastify.prisma.user.findUnique({ where: { id: payload.sub }, select: { name: true } }))?.name ?? "Admin" };
    return reply.status(201).send(await addInterpreterNote(id, content, payload.organization_id, actor, fastify.prisma, image_url ?? null));
  });

  fastify.post("/:id/note-image", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    try {
      const filename = imageFilename(data.filename, data.mimetype);
      const url = await uploadImage(data, noteImagePath("interpreter", id, filename));
      return reply.send({ url });
    } catch (err) {
      if (err instanceof ImageUploadError) return reply.status(400).send({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  fastify.post("/:id/photo", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;

    const data = await req.file();
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });

    if (!ALLOWED_MIME.has(data.mimetype)) {
      return reply.status(400).send({ error: { code: "INVALID_FILE_TYPE", message: "Only JPEG and PNG images are accepted" } });
    }

    const ext = extname(data.filename) || (data.mimetype === "image/png" ? ".png" : ".jpg");
    const filename = `${randomUUID()}${ext}`;
    const filepath = join(UPLOADS_DIR, filename);

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    await writeFile(filepath, Buffer.concat(chunks));

    const url = `/uploads/${filename}`;
    const interpreter = await fastify.prisma.interpreter.findFirst({
      where: { id, organization_id: payload.organization_id },
    });
    if (!interpreter) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Interpreter not found" } });

    await fastify.prisma.interpreter.update({ where: { id }, data: { profile_picture_url: url } });

    return reply.send({ url });
  });
}
