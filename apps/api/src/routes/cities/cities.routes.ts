import type { FastifyInstance } from "fastify";
import { CreateCityBodySchema, UpdateCityBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listCities, createCity, renameCity, deleteCity } from "./cities.service.js";

export default async function cityRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_interpreters")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listCities(payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreateCityBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const city = await createCity(body, payload.organization_id, fastify.prisma);
    return reply.status(201).send(city);
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateCityBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await renameCity(id, body, payload.organization_id, fastify.prisma));
  });

  fastify.delete("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await deleteCity(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });
}
