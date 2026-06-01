import type { FastifyInstance } from "fastify";
import { authenticateAdmin } from "../../middleware/auth.js";
import type { JwtPayload } from "../../middleware/auth.js";

export default async function alertRoutes(fastify: FastifyInstance) {
  // GET /alerts — list unread alerts for org
  fastify.get("/", { preHandler: authenticateAdmin }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    const alerts = await fastify.prisma.adminAlert.findMany({
      where: { organization_id: payload.organization_id },
      orderBy: [{ is_read: "asc" }, { created_at: "desc" }],
      take: 50,
    });
    const unread_count = alerts.filter((a) => !a.is_read).length;
    return reply.send({ data: alerts, unread_count });
  });

  // PATCH /alerts/read-all — mark all as read
  fastify.patch("/read-all", { preHandler: authenticateAdmin }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    await fastify.prisma.adminAlert.updateMany({
      where: { organization_id: payload.organization_id, is_read: false },
      data: { is_read: true },
    });
    return reply.send({ ok: true });
  });

  // PATCH /alerts/:id/read — mark one as read
  fastify.patch("/:id/read", { preHandler: authenticateAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await fastify.prisma.adminAlert.updateMany({
      where: { id, organization_id: payload.organization_id },
      data: { is_read: true },
    });
    return reply.send({ ok: true });
  });
}
