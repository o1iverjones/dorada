import type { FastifyInstance } from "fastify";
import {
  UpdateSystemSettingsBodySchema,
  CreateAppointmentTypeBodySchema,
  UpdateAppointmentTypeBodySchema,
  UpdateLanguageListBodySchema,
  UpdateLocalizationStringsBodySchema,
} from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import {
  getSettings, updateSettings, createAppointmentType, updateAppointmentType,
  deactivateAppointmentType, updateLanguages, getLocalizationStrings, updateLocalizationStrings,
  listInterpreterRates, createInterpreterRate, deleteInterpreterRate,
  listReminderConfigs, createReminderConfig, updateReminderConfig, deleteReminderConfig,
} from "./settings.service.js";

export default async function settingsRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_system_settings")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await getSettings(payload.organization_id, fastify.prisma));
  });

  fastify.patch("/", { preHandler }, async (req, reply) => {
    const body = UpdateSystemSettingsBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateSettings(body, payload.organization_id, fastify.prisma));
  });

  fastify.post("/appointment-types", { preHandler }, async (req, reply) => {
    const body = CreateAppointmentTypeBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createAppointmentType(body, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/appointment-types/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateAppointmentTypeBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateAppointmentType(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/appointment-types/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deactivateAppointmentType(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });

  fastify.patch("/languages", { preHandler }, async (req, reply) => {
    const body = UpdateLanguageListBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateLanguages(body, payload.organization_id, fastify.prisma));
  });

  fastify.get("/interpreter-rates", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listInterpreterRates(payload.organization_id, fastify.prisma));
  });

  fastify.post("/interpreter-rates", { preHandler }, async (req, reply) => {
    const { title, amount } = req.body as { title: string; amount: number };
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createInterpreterRate({ title, amount }, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/interpreter-rates/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deleteInterpreterRate(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });

  // ─── Interpreter reminder configs ────────────────────────────────────────────

  fastify.get("/reminder-configs", { preHandler }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listReminderConfigs(payload.organization_id, fastify.prisma));
  });

  fastify.post("/reminder-configs", { preHandler }, async (req, reply) => {
    const { offset_minutes, label } = req.body as { offset_minutes: number; label: string };
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await createReminderConfig({ offset_minutes, label }, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/reminder-configs/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { offset_minutes?: number; label?: string };
    const payload = req.user as JwtPayload;
    return reply.send(await updateReminderConfig(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/reminder-configs/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deleteReminderConfig(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });

  fastify.get("/localization/:locale", { preHandler }, async (req, reply) => {
    const { locale } = req.params as { locale: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getLocalizationStrings(locale, payload.organization_id, fastify.prisma));
  });

  fastify.patch("/localization/:locale", { preHandler }, async (req, reply) => {
    const { locale } = req.params as { locale: string };
    const body = UpdateLocalizationStringsBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateLocalizationStrings(locale, body, payload.organization_id, fastify.prisma));
  });
}
