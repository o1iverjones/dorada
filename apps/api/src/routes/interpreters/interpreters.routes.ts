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
} from "@pulpito/types";
import { authenticateAdmin, authenticateInterpreter } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import {
  listInterpreters, getInterpreter, createInterpreter, updateInterpreter,
  deactivateInterpreter, updateSelf, listAvailabilityBlocks,
  createAvailabilityBlock, deleteAvailabilityBlock,
} from "./interpreters.service.js";

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

  fastify.get("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreter(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const body = CreateInterpreterBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createInterpreter(body, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateInterpreterBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateInterpreter(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_interpreters")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deactivateInterpreter(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
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
