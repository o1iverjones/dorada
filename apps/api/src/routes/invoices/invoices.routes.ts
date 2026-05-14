import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InvoiceListQuerySchema, ApproveInvoiceBodySchema } from "@pulpito/types";
import { authenticateAdmin, authenticateInterpreter } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import {
  listInvoices,
  getInvoice,
  approveInvoice,
  getInvoiceStats,
  getInterpreterInvoices,
} from "./invoices.service.js";

export default async function invoiceRoutes(fastify: FastifyInstance) {
  // GET /invoices/stats — pending count for dashboard
  fastify.get("/stats", { preHandler: [authenticateAdmin, requirePermission("manage_invoices")] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await getInvoiceStats(payload.organization_id, fastify.prisma));
  });

  // GET /invoices — list all invoices for org
  fastify.get("/", { preHandler: [authenticateAdmin, requirePermission("manage_invoices")] }, async (req, reply) => {
    const query = InvoiceListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listInvoices(query, payload.organization_id, fastify.prisma));
  });

  // GET /invoices/:id — single invoice
  fastify.get("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_invoices")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const payload = req.user as JwtPayload;
    return reply.send(await getInvoice(id, payload.organization_id, fastify.prisma));
  });

  // PATCH /invoices/:id/approve
  fastify.patch("/:id/approve", { preHandler: [authenticateAdmin, requirePermission("manage_invoices")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = ApproveInvoiceBodySchema.parse(req.body ?? {});
    const payload = req.user as JwtPayload;
    return reply.send(await approveInvoice(id, payload.organization_id, payload.sub, body, fastify.prisma));
  });

  // GET /invoices/me — interpreter's own invoices + summary
  fastify.get("/me", { preHandler: [authenticateInterpreter] }, async (req, reply) => {
    const query = z.object({
      date_from: z.string().date().optional(),
      date_to: z.string().date().optional(),
    }).parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreterInvoices(payload.sub, fastify.prisma, query.date_from, query.date_to));
  });
}
