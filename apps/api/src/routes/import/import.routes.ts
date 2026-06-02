import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import type { JwtPayload } from "../../middleware/auth.js";
import {
  getTemplateCsv,
  importInterpreters,
  importClinics,
  importPatients,
  importInsuranceAgencies,
  importAppointments,
  type EntityType,
} from "./import.service.js";

const ENTITY_PERMISSIONS: Record<EntityType, string> = {
  interpreters: "manage_interpreters",
  clinics: "manage_clinics",
  patients: "manage_appointments",
  "agencies": "manage_clinics",
  appointments: "manage_appointments",
};

export default async function importRoutes(fastify: FastifyInstance) {
  // GET /import/template/:entity  — download a CSV template
  fastify.get<{ Params: { entity: EntityType } }>(
    "/template/:entity",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { entity } = request.params;
      const validEntities: EntityType[] = ["interpreters", "clinics", "patients", "agencies"];
      if (!validEntities.includes(entity)) {
        return reply.status(400).send({ error: { code: "INVALID_ENTITY", message: "Unknown entity type" } });
      }
      const csv = getTemplateCsv(entity);
      reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${entity}-template.csv"`)
        .send(csv);
    },
  );

  // POST /import/:entity  — upload and process a CSV file
  fastify.post<{ Params: { entity: EntityType } }>(
    "/:entity",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { entity } = request.params;
      const payload = request.user as JwtPayload;
      const organizationId = payload.organization_id;

      const permission = ENTITY_PERMISSIONS[entity];
      if (!permission) {
        return reply.status(400).send({ error: { code: "INVALID_ENTITY", message: "Unknown entity type" } });
      }

      // Permission check
      if (!payload.permissions?.includes(permission)) {
        return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const csvText = Buffer.concat(chunks).toString("utf-8");

      if (!csvText.trim()) {
        return reply.status(400).send({ error: { code: "EMPTY_FILE", message: "File is empty" } });
      }

      let result;
      switch (entity) {
        case "interpreters":
          result = await importInterpreters(csvText, organizationId, fastify.prisma);
          break;
        case "clinics":
          result = await importClinics(csvText, organizationId, fastify.prisma);
          break;
        case "patients":
          result = await importPatients(csvText, organizationId, fastify.prisma);
          break;
        case "agencies":
          result = await importInsuranceAgencies(csvText, organizationId, fastify.prisma);
          break;
        case "appointments":
          result = await importAppointments(csvText, organizationId, fastify.prisma);
          break;
      }

      return reply.send(result);
    },
  );
}
