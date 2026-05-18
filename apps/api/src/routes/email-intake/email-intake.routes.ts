import type { FastifyInstance } from "fastify";
import { EmailIntakeLogListQuerySchema, EmailIntakeDraftListQuerySchema, ReviewEmailIntakeDraftBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import {
  listEmailIntakeLogs, getEmailIntakeLog, listEmailIntakeDrafts,
  reviewEmailIntakeDraft, retryConfirmation,
} from "./email-intake.service.js";
import { getQueues } from "../../workers/queues.js";

export default async function emailIntakeRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_appointments")];

  fastify.get("/logs", { preHandler }, async (req, reply) => {
    const query = EmailIntakeLogListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listEmailIntakeLogs(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/logs/:log_id", { preHandler }, async (req, reply) => {
    const { log_id } = req.params as { log_id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getEmailIntakeLog(log_id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/logs/:log_id/retry-confirmation", { preHandler }, async (req, reply) => {
    const { log_id } = req.params as { log_id: string };
    const payload = req.user as JwtPayload;
    const { emailIntakeQueue } = getQueues();
    return reply.status(202).send(await retryConfirmation(log_id, payload.organization_id, fastify.prisma, emailIntakeQueue));
  });

  fastify.get("/drafts", { preHandler }, async (req, reply) => {
    const query = EmailIntakeDraftListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listEmailIntakeDrafts(query, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/drafts/:draft_id", { preHandler }, async (req, reply) => {
    const { draft_id } = req.params as { draft_id: string };
    const body = ReviewEmailIntakeDraftBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await reviewEmailIntakeDraft(draft_id, payload.organization_id, body, fastify.prisma));
  });
}
