import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClinicListQuerySchema, CreateClinicBodySchema, UpdateClinicBodySchema, CreateClinicInterpreterNoteBodySchema, UpdateClinicInterpreterNoteBodySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listClinics, getClinic, createClinic, updateClinic, deactivateClinic, setInterpreterBlocks, getClinicActivity, getClinicNotes, addClinicNote, listInterpreterNotes, createInterpreterNote, updateInterpreterNote, deleteInterpreterNote, listClinicDoctors, addClinicDoctor, removeClinicDoctor } from "./clinics.service.js";
import { writeActivityLog } from "../../lib/activityLog.js";
import { uploadImage, imageFilename, ImageUploadError } from "../../lib/uploadImage.js";
import { noteImagePath } from "../../integrations/r2.js";

export default async function clinicRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("manage_clinics")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = ClinicListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listClinics(query, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getClinic(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = CreateClinicBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const clinic = await createClinic(body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "clinic", entityId: clinic.id, entityName: clinic.name, action: "created", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(201).send(clinic);
  });

  fastify.patch("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateClinicBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;

    const before = await fastify.prisma.clinic.findUnique({ where: { id } });
    const clinic = await updateClinic(id, body, payload.organization_id, fastify.prisma);

    const changed: string[] = [];
    if (body.name !== undefined && body.name !== before?.name) changed.push("Name");
    if (body.address !== undefined && body.address !== before?.address) changed.push("Address");
    if (body.phone !== undefined && body.phone !== before?.phone) changed.push("Phone");
    if (body.parking !== undefined && body.parking !== before?.parking) changed.push("Parking");
    if (body.primary_contact !== undefined) {
      if (body.primary_contact.name !== before?.primary_contact_name) changed.push("Primary contact name");
      if ((body.primary_contact.email ?? null) !== before?.primary_contact_email) changed.push("Primary contact email");
      if ((body.primary_contact.phone ?? null) !== before?.primary_contact_phone) changed.push("Primary contact phone");
    }
    if (body.billing !== undefined) {
      if (body.billing.model !== before?.billing_model) changed.push("Billing model");
      if (body.billing.hourly_rate != null && Number(body.billing.hourly_rate) !== Number(before?.billing_hourly_rate)) changed.push("Hourly rate");
      if (body.billing.flat_rate != null && Number(body.billing.flat_rate) !== Number(before?.billing_flat_rate)) changed.push("Flat rate");
    }
    if (body.is_active !== undefined && body.is_active !== before?.is_active) {
      changed.push(body.is_active ? "Reactivated" : "Deactivated");
    }

    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "clinic",
      entityId: id,
      entityName: clinic.name,
      action: "updated",
      detail: changed.length ? changed.join(", ") : null,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.send(clinic);
  });

  fastify.get("/:id/activity", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getClinicActivity(id, payload.organization_id, fastify.prisma));
  });

  fastify.get("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getClinicNotes(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/admin-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content, image_url } = z.object({ content: z.string().max(800), image_url: z.string().url().nullish() }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = payload.name
      ? { id: payload.sub, name: payload.name }
      : { id: payload.sub, name: (await fastify.prisma.user.findUnique({ where: { id: payload.sub }, select: { name: true } }))?.name ?? "Admin" };
    return reply.status(201).send(await addClinicNote(id, content, payload.organization_id, actor, fastify.prisma, image_url ?? null));
  });

  // POST /clinics/:id/note-image  (upload image before saving a note)
  fastify.post("/:id/note-image", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    try {
      const filename = imageFilename(data.filename, data.mimetype);
      const url = await uploadImage(data, noteImagePath("clinic", id, filename));
      return reply.send({ url });
    } catch (err) {
      if (err instanceof ImageUploadError) return reply.status(400).send({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  fastify.put("/:id/interpreter-blocks", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { interpreter_ids } = req.body as { interpreter_ids: string[] };
    const payload = req.user as JwtPayload;

    const [prevBlocks, clinic] = await Promise.all([
      fastify.prisma.clinicInterpreterBlock.findMany({
        where: { clinic_id: id },
        include: { interpreter: { select: { id: true, name: true } } },
      }),
      fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } }),
    ]);

    const result = await setInterpreterBlocks(id, interpreter_ids, payload.organization_id, fastify.prisma);

    const prevIds = new Set(prevBlocks.map((b) => b.interpreter_id));
    const newIds = new Set(interpreter_ids);
    const added = result.filter((i) => !prevIds.has(i.id)).map((i) => i.name);
    const removed = prevBlocks.filter((b) => !newIds.has(b.interpreter_id)).map((b) => b.interpreter.name);

    if (added.length > 0 || removed.length > 0) {
      const parts: string[] = [];
      if (added.length) parts.push(`Added: ${added.join(", ")}`);
      if (removed.length) parts.push(`Removed: ${removed.join(", ")}`);
      await writeActivityLog(fastify.prisma, {
        organizationId: payload.organization_id,
        entityType: "clinic",
        entityId: id,
        entityName: clinic?.name ?? null,
        action: "exclusions_updated",
        detail: parts.join("; "),
        adminId: payload.sub,
        adminName: payload.name ?? "Admin",
      });
    }

    return reply.send(result);
  });

  fastify.get("/:id/interpreter-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await listInterpreterNotes(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/interpreter-notes", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = CreateClinicInterpreterNoteBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const [note, clinic] = await Promise.all([
      createInterpreterNote(id, body, payload.organization_id, fastify.prisma),
      fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } }),
    ]);
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "clinic",
      entityId: id,
      entityName: clinic?.name ?? null,
      action: "interpreter_note_added",
      detail: `[${body.type}] ${body.content.slice(0, 80)}${body.content.length > 80 ? "…" : ""}`,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.status(201).send(note);
  });

  fastify.patch("/:id/interpreter-notes/:noteId", { preHandler }, async (req, reply) => {
    const { id, noteId } = req.params as { id: string; noteId: string };
    const body = UpdateClinicInterpreterNoteBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const [note, clinic] = await Promise.all([
      updateInterpreterNote(id, noteId, body, payload.organization_id, fastify.prisma),
      fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } }),
    ]);
    const isToggle = body.is_active !== undefined && Object.keys(body).length === 1;
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "clinic",
      entityId: id,
      entityName: clinic?.name ?? null,
      action: isToggle ? (body.is_active ? "interpreter_note_activated" : "interpreter_note_deactivated") : "interpreter_note_updated",
      detail: body.content ? `${body.content.slice(0, 80)}${body.content.length > 80 ? "…" : ""}` : null,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.send(note);
  });

  fastify.delete("/:id/interpreter-notes/:noteId", { preHandler }, async (req, reply) => {
    const { id, noteId } = req.params as { id: string; noteId: string };
    const payload = req.user as JwtPayload;
    const [clinic, note] = await Promise.all([
      fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } }),
      fastify.prisma.clinicInterpreterNote.findUnique({ where: { id: noteId }, select: { content: true, type: true } }),
    ]);
    await deleteInterpreterNote(id, noteId, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "clinic",
      entityId: id,
      entityName: clinic?.name ?? null,
      action: "interpreter_note_removed",
      detail: note ? `[${note.type}] ${note.content.slice(0, 80)}${note.content.length > 80 ? "…" : ""}` : null,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.status(204).send();
  });

  // ─── Doctors ─────────────────────────────────────────────────────────────────

  fastify.get("/:id/doctors", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await listClinicDoctors(id, payload.organization_id, fastify.prisma));
  });

  fastify.post("/:id/doctors", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { name } = z.object({ name: z.string().min(1).max(200) }).parse(req.body);
    const payload = req.user as JwtPayload;
    const doctor = await addClinicDoctor(id, name, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "clinic",
      entityId: id,
      entityName: (await fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } }))?.name ?? null,
      action: "doctor_added",
      detail: name,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.status(201).send(doctor);
  });

  fastify.delete("/:id/doctors/:doctorId", { preHandler }, async (req, reply) => {
    const { id, doctorId } = req.params as { id: string; doctorId: string };
    const payload = req.user as JwtPayload;
    const doctor = await fastify.prisma.clinicDoctor.findUnique({ where: { id: doctorId }, select: { name: true } });
    await removeClinicDoctor(id, doctorId, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, {
      organizationId: payload.organization_id,
      entityType: "clinic",
      entityId: id,
      entityName: (await fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } }))?.name ?? null,
      action: "doctor_removed",
      detail: doctor?.name ?? null,
      adminId: payload.sub,
      adminName: payload.name ?? "Admin",
    });
    return reply.status(204).send();
  });

  fastify.delete("/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const existing = await fastify.prisma.clinic.findUnique({ where: { id }, select: { name: true } });
    await deactivateClinic(id, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "clinic", entityId: id, entityName: existing?.name ?? null, action: "deactivated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(204).send();
  });
}
