import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { Permission } from "@dorada/types";
import { z } from "zod";
import { NotFoundError } from "./errors.js";
import { uploadImage, imageFilename, ImageUploadError } from "./uploadImage.js";
import { noteImagePath } from "../integrations/r2.js";
import { authenticateAdmin } from "../middleware/auth.js";
import type { JwtPayload } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

/**
 * Shared "admin notes + activity log" plumbing for entities that store notes in
 * a dedicated `*_notes` table (one row per note) and activity in the shared
 * `activity_log` table (keyed by entity_type + entity_id).
 *
 * Appointments are intentionally NOT handled here — they use a separate
 * `appointment_activity` table and bespoke note-add logic (PO / patient backfill).
 */
export type EntityType = "clinic" | "agency" | "insurance_company" | "patient" | "interpreter";

interface ParentDelegate {
  findUnique(args: { where: { id: string }; select: Record<string, true> }): Promise<{ organization_id: string; name?: string | null } | null>;
}
interface NoteDelegate {
  findMany(args: { where: Record<string, string>; orderBy: { created_at: "desc" } }): Promise<unknown[]>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}

interface EntityConfig {
  /** Parent record delegate — used for the tenant-ownership check. */
  parent: (p: PrismaClient) => ParentDelegate;
  /** Note-table delegate. */
  notes: (p: PrismaClient) => NoteDelegate;
  /** Foreign-key column on the note table (e.g. "clinic_id"). */
  fk: string;
  /** Error code thrown when the parent record is missing / cross-tenant. */
  notFoundCode: string;
}

const CONFIG: Record<EntityType, EntityConfig> = {
  clinic: {
    parent: (p) => p.clinic as unknown as ParentDelegate,
    notes: (p) => p.clinicNote as unknown as NoteDelegate,
    fk: "clinic_id",
    notFoundCode: "CLINIC_NOT_FOUND",
  },
  agency: {
    parent: (p) => p.agency as unknown as ParentDelegate,
    notes: (p) => p.agencyNote as unknown as NoteDelegate,
    fk: "agency_id",
    notFoundCode: "AGENCY_NOT_FOUND",
  },
  insurance_company: {
    parent: (p) => p.insuranceCompany as unknown as ParentDelegate,
    notes: (p) => p.insuranceCompanyNote as unknown as NoteDelegate,
    fk: "insurance_company_id",
    notFoundCode: "INSURANCE_COMPANY_NOT_FOUND",
  },
  patient: {
    parent: (p) => p.patient as unknown as ParentDelegate,
    notes: (p) => p.patientNote as unknown as NoteDelegate,
    fk: "patient_id",
    notFoundCode: "PATIENT_NOT_FOUND",
  },
  interpreter: {
    parent: (p) => p.interpreter as unknown as ParentDelegate,
    notes: (p) => p.interpreterNote as unknown as NoteDelegate,
    fk: "interpreter_id",
    notFoundCode: "INTERPRETER_NOT_FOUND",
  },
};

async function ensureTenant(
  entity: EntityType,
  id: string,
  organizationId: string,
  prisma: PrismaClient,
): Promise<{ organization_id: string; name?: string | null }> {
  const cfg = CONFIG[entity];
  const parent = await cfg.parent(prisma).findUnique({ where: { id }, select: { organization_id: true, name: true } });
  if (!parent || parent.organization_id !== organizationId) {
    throw new NotFoundError(cfg.notFoundCode, "Not found");
  }
  return parent;
}

export async function getEntityNotes(entity: EntityType, id: string, organizationId: string, prisma: PrismaClient) {
  await ensureTenant(entity, id, organizationId, prisma);
  const cfg = CONFIG[entity];
  return cfg.notes(prisma).findMany({ where: { [cfg.fk]: id }, orderBy: { created_at: "desc" } });
}

export async function addEntityNote(
  entity: EntityType,
  id: string,
  content: string,
  organizationId: string,
  actor: { id: string; name: string },
  prisma: PrismaClient,
  imageUrl: string | null = null,
) {
  const parent = await ensureTenant(entity, id, organizationId, prisma);
  const cfg = CONFIG[entity];
  const note = await cfg.notes(prisma).create({
    data: {
      [cfg.fk]: id,
      organization_id: organizationId,
      content,
      admin_id: actor.id,
      admin_name: actor.name,
      image_url: imageUrl,
    },
  });
  // Mirror the note into the shared activity log so every entity's Activity Log
  // shows a "note added" entry consistently.
  await prisma.activityLog.create({
    data: {
      organization_id: organizationId,
      entity_type: entity,
      entity_id: id,
      entity_name: parent.name ?? null,
      action: "note_added",
      admin_id: actor.id,
      admin_name: actor.name,
    },
  });
  return note;
}

export async function getEntityActivity(entity: EntityType, id: string, organizationId: string, prisma: PrismaClient) {
  await ensureTenant(entity, id, organizationId, prisma);
  return prisma.activityLog.findMany({
    where: { entity_type: entity, entity_id: id, organization_id: organizationId },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Registers the four shared note/activity routes on an entity's route plugin:
 *   GET  /:id/admin-notes
 *   POST /:id/admin-notes
 *   POST /:id/note-image
 *   GET  /:id/activity
 * Call inside the entity's route plugin (paths are relative to its prefix).
 */
export function registerEntityNotesRoutes(fastify: FastifyInstance, opts: { entity: EntityType; permission: Permission }) {
  const preHandler = [authenticateAdmin, requirePermission(opts.permission)];

  fastify.get("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getEntityNotes(opts.entity, id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content, image_url } = z.object({ content: z.string().max(800), image_url: z.string().url().nullish() }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = payload.name
      ? { id: payload.sub, name: payload.name }
      : { id: payload.sub, name: (await fastify.prisma.user.findUnique({ where: { id: payload.sub }, select: { name: true } }))?.name ?? "Admin" };
    return reply.status(201).send(await addEntityNote(opts.entity, id, content, payload.organization_id, actor, fastify.prisma, image_url ?? null));
  });

  fastify.post("/:id/note-image", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    try {
      const filename = imageFilename(data.filename, data.mimetype);
      const url = await uploadImage(data, noteImagePath(opts.entity, id, filename));
      return reply.send({ url });
    } catch (err) {
      if (err instanceof ImageUploadError) return reply.status(400).send({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  fastify.get("/:id/activity", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getEntityActivity(opts.entity, id, payload.organization_id, fastify.prisma));
  });
}
