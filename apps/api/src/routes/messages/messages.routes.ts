import type { FastifyInstance } from "fastify";
import { SendMessageBodySchema } from "@pulpito/types";
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
    const query = z.object({ cursor: z.string().optional(), limit: z.coerce.number().default(50) }).parse(req.query);
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.send(await listMessages(interpreter_id, payload.sub, isAdmin, payload.organization_id, query, fastify.prisma));
  });

  fastify.post("/conversations/:interpreter_id", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const body = SendMessageBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.status(201).send(await sendMessage(interpreter_id, payload.sub, isAdmin, payload.organization_id, body, fastify.prisma));
  });

  fastify.post("/conversations/:interpreter_id/read", { preHandler: authenticate }, async (req, reply) => {
    const { interpreter_id } = req.params as { interpreter_id: string };
    const payload = req.user as JwtPayload;
    const isAdmin = payload.type === "admin";
    return reply.send(await markRead(interpreter_id, payload.sub, isAdmin, payload.organization_id, fastify.prisma));
  });
}
