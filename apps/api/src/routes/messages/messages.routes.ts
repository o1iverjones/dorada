import type { FastifyInstance } from "fastify";
import { SendMessageBodySchema } from "@dorada/types";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listConversations, listMessages, sendMessage, markRead, searchMessages } from "./messages.service.js";
import { uploadImage, imageFilename, ImageUploadError } from "../../lib/uploadImage.js";
import { messageImagePath } from "../../integrations/r2.js";

export default async function messageRoutes(fastify: FastifyInstance) {
  fastify.get("/search", { preHandler: authenticate }, async (req, reply) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await searchMessages(payload.organization_id, q, fastify.prisma));
  });

  fastify.get("/conversations", { preHandler: authenticate }, async (req, reply) => {
    const query = z.object({ cursor: z.string().optional(), limit: z.coerce.number().default(25) }).parse(req.query);
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.send(await listConversations(payload.organization_id, payload.sub, isAdmin, query, fastify.prisma));
  });

  fastify.get("/conversations/:interpreter_id", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const query = z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().default(50),
      since: z.string().optional(),
    }).parse(req.query);
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.send(await listMessages(interpreter_id, payload.sub, isAdmin, payload.organization_id, query, fastify.prisma));
  });

  fastify.post("/conversations/:interpreter_id", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const body = SendMessageBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    const message = await sendMessage(interpreter_id, payload.sub, isAdmin, payload.organization_id, body, fastify.prisma);
    const emitPayload = {
      id: message.id,
      body: message.body,
      image_url: message.image_url ?? null,
      sender_type: message.sender_type,
      sender: message.sender_type === "admin" && message.sender_user
        ? { id: message.sender_user.id, name: message.sender_user.name }
        : { id: message.interpreter.id, name: message.interpreter.name },
      sent_at: message.sent_at.toISOString(),
      read_at: null,
    };
    // Deliver to the open conversation (both sides)
    fastify.io.to(`conv:${payload.organization_id}:${interpreter_id}`).emit("new_message", emitPayload);
    // Also notify all admins for the unread badge, regardless of which page they're on
    if (!payload.type || payload.type === "interpreter") {
      fastify.io.to(`notify:${payload.organization_id}`).emit("new_message", emitPayload);
    }
    return reply.status(201).send(emitPayload);
  });

  // POST /messages/conversations/:interpreter_id/media  (upload image, returns URL)
  fastify.post("/conversations/:interpreter_id/media", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    try {
      const filename = imageFilename(data.filename, data.mimetype);
      const url = await uploadImage(data, messageImagePath(interpreter_id, filename));
      return reply.send({ url });
    } catch (err) {
      if (err instanceof ImageUploadError) return reply.status(400).send({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  fastify.post("/conversations/:interpreter_id/read", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.send(await markRead(interpreter_id, payload.sub, isAdmin, payload.organization_id, fastify.prisma));
  });
}
