import type { FastifyInstance } from "fastify";
import { SendMessageBodySchema } from "@dorada/types";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listConversations, listMessages, sendMessage, markRead } from "./messages.service.js";

export default async function messageRoutes(fastify: FastifyInstance) {
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

  fastify.post("/conversations/:interpreter_id/read", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.send(await markRead(interpreter_id, payload.sub, isAdmin, payload.organization_id, fastify.prisma));
  });
}
