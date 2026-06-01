import type { FastifyInstance } from "fastify";
import { authenticateAdmin } from "../../middleware/auth.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { writeActivityLog } from "../../lib/activityLog.js";

export default async function alertRoutes(fastify: FastifyInstance) {
  // GET /alerts — list alerts for org
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
    const unread = await fastify.prisma.adminAlert.findMany({
      where: { organization_id: payload.organization_id, is_read: false },
      select: { id: true },
    });
    if (unread.length > 0) {
      await fastify.prisma.adminAlert.updateMany({
        where: { organization_id: payload.organization_id, is_read: false },
        data: { is_read: true },
      });
      await writeActivityLog(fastify.prisma, {
        organizationId: payload.organization_id,
        entityType: "appointment",
        entityId: payload.organization_id,
        entityName: null,
        action: "alerts_marked_read",
        detail: `Marked ${unread.length} alert${unread.length === 1 ? "" : "s"} as read`,
        adminId: payload.sub,
        adminName: payload.name ?? "Admin",
      });
    }
    return reply.send({ ok: true });
  });

  // PATCH /alerts/:id/read — mark one as read
  fastify.patch("/:id/read", { preHandler: authenticateAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const alert = await fastify.prisma.adminAlert.findFirst({
      where: { id, organization_id: payload.organization_id },
    });
    if (alert && !alert.is_read) {
      await fastify.prisma.adminAlert.update({
        where: { id },
        data: { is_read: true },
      });
      await writeActivityLog(fastify.prisma, {
        organizationId: payload.organization_id,
        entityType: "appointment",
        entityId: alert.appointment_id ?? id,
        entityName: null,
        action: "alert_marked_read",
        detail: alert.message,
        poNumber: null,
        adminId: payload.sub,
        adminName: payload.name ?? "Admin",
      });
    }
    return reply.send({ ok: true });
  });
}
