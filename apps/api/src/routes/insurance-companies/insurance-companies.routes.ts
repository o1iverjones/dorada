import type { FastifyInstance } from "fastify";
import { CreateInsuranceCompanyBodySchema, UpdateInsuranceCompanyBodySchema, InsuranceCompanyListQuerySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { writeActivityLog } from "../../lib/activityLog.js";
import { registerEntityNotesRoutes } from "../../lib/entityNotes.js";
import {
  listInsuranceCompanies,
  getInsuranceCompany,
  createInsuranceCompany,
  updateInsuranceCompany,
} from "./insurance-companies.service.js";

export default async function insuranceCompanyRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_clinics")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = InsuranceCompanyListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listInsuranceCompanies(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getInsuranceCompany(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreateInsuranceCompanyBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const company = await createInsuranceCompany(body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "insurance_company",
      entityId: company.id,
      entityName: company.name,
      action: "created",
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.status(201).send(company);
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateInsuranceCompanyBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;

    const before = await fastify.prisma.insuranceCompany.findUnique({ where: { id } });
    const company = await updateInsuranceCompany(id, body, payload.organization_id, fastify.prisma);

    const changed: string[] = [];
    if (body.name !== undefined && body.name !== before?.name) changed.push("Name");
    if (body.phone !== undefined && body.phone !== before?.phone) changed.push("Phone");
    if (body.email !== undefined && body.email !== before?.email) changed.push("Email");
    if (body.is_active !== undefined && body.is_active !== before?.is_active) {
      changed.push(body.is_active ? "Reactivated" : "Deactivated");
    }

    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "insurance_company",
      entityId: id,
      entityName: company.name,
      action: body.is_active !== undefined && Object.keys(body).length === 1
        ? (body.is_active ? "reactivated" : "deactivated")
        : "updated",
      detail: changed.length ? changed.join(", ") : null,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.send(company);
  });

  registerEntityNotesRoutes(fastify, { entity: "insurance_company", permission: "manage_clinics" });

  fastify.delete("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const existing = await fastify.prisma.insuranceCompany.findUnique({ where: { id }, select: { name: true } });
    await updateInsuranceCompany(id, { is_active: false }, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "insurance_company",
      entityId: id,
      entityName: existing?.name ?? null,
      action: "deactivated",
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.status(204).send();
  });
}
