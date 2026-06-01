import type { FastifyInstance } from "fastify";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { extname } from "path";
import {
  AppointmentListQuerySchema,
  CreateAppointmentBodySchema,
  UpdateAppointmentBodySchema,
  OfferAppointmentBodySchema,
  ShiftNotesBodySchema,
  SubmitFollowUpBodySchema,
  ReviewFollowUpDraftBodySchema,
} from "@dorada/types";
import { z } from "zod";
import { authenticate, authenticateAdmin, authenticateInterpreter } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { sendExpoPushNotifications } from "../../lib/push.js";
import {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  offerAppointment,
  confirmOffer,
  declineOffer,
  clockIn,
  clockOut,
  markPatientArrived,
  addShiftNotes,
  getInterpreterAppointments,
  getInterpreterAppointment,
  getInterpreterOffers,
  submitFollowUp,
  listFollowUpDrafts,
  reviewFollowUpDraft,
  getOrgActivityLog,
  getActivityLog,
  getAdminNotes,
  addAdminNote,
  patchClockTimes,
  uploadAppointmentMedia,
  getAppointmentMedia,
  manualConfirmInterpreter,
  unassignInterpreter,
} from "./appointments.service.js";

async function resolveActor(payload: JwtPayload, fastify: FastifyInstance) {
  if (payload.name) return { id: payload.sub, name: payload.name };
  const user = await fastify.prisma.user.findUnique({ where: { id: payload.sub }, select: { name: true } });
  return { id: payload.sub, name: user?.name ?? "Admin" };
}

export default async function appointmentRoutes(fastify: FastifyInstance) {
  // GET /appointments
  fastify.get("/", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const query = AppointmentListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listAppointments(query, payload.organization_id, fastify.prisma));
  });

  // GET /appointments/follow-up-drafts
  fastify.get("/follow-up-drafts", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const query = z.object({ status: z.string().optional(), cursor: z.string().optional(), limit: z.coerce.number().default(25) }).parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listFollowUpDrafts(payload.organization_id, query, fastify.prisma));
  });

  // GET /appointments/:id
  fastify.get("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAppointment(id, payload.organization_id, fastify.prisma));
  });

  // POST /appointments
  fastify.post("/", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const body = CreateAppointmentBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    return reply.status(201).send(await createAppointment(body, payload.organization_id, actor, fastify.prisma));
  });

  // PATCH /appointments/:id
  fastify.patch("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateAppointmentBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    return reply.send(await updateAppointment(id, body, payload.organization_id, actor, fastify.prisma));
  });

  // PATCH /appointments/:id/clock-times
  fastify.patch("/:id/clock-times", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      clock_in_time: z.string().datetime().optional(),
      patient_arrived_at: z.string().datetime().optional(),
      clock_out_time: z.string().datetime().optional(),
    }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    const result = await patchClockTimes(id, body, payload.organization_id, actor, fastify.prisma);

    // Schedule long-appointment alert when clock_in is set (and clock_out is not yet set)
    if (body.clock_in_time && !body.clock_out_time) {
      const settings = await fastify.prisma.systemSettings.findUnique({
        where: { organization_id: payload.organization_id },
        select: { long_appointment_alert_minutes: true },
      });
      const alertMinutes = settings?.long_appointment_alert_minutes ?? 105;
      const clockInMs = new Date(body.clock_in_time).getTime();
      const delay = clockInMs + alertMinutes * 60_000 - Date.now();
      if (delay > 0) {
        const { getQueues } = await import("../../workers/queues.js");
        await getQueues().adminAlertQueue.add(
          "long-appointment",
          { appointmentId: id, organizationId: payload.organization_id, alertMinutes },
          { delay, jobId: `long-appt:${id}`, removeOnComplete: true },
        );
      }
    }

    // Cancel pending long-appointment alert if clock_out is being set
    if (body.clock_out_time) {
      const { getQueues } = await import("../../workers/queues.js");
      const job = await getQueues().adminAlertQueue.getJob(`long-appt:${id}`);
      if (job) await job.remove();
    }

    return reply.send(result);
  });

  // DELETE /appointments/:id
  fastify.delete("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    await cancelAppointment(id, payload.organization_id, actor, fastify.prisma);
    return reply.status(204).send();
  });

  // POST /appointments/:id/offers
  fastify.post("/:id/offers", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = OfferAppointmentBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    const result = await offerAppointment(id, body, payload.organization_id, actor, fastify.prisma);

    // Send push notifications to each interpreter who received an offer
    const appt = await fastify.prisma.appointment.findUnique({
      where: { id },
      include: { clinic: { select: { name: true } } },
    });
    const dateStr = appt ? new Date(appt.date_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const clinicName = appt?.clinic?.name ?? "";

    const interpreterIds = result.offers.map((o) => o.interpreter.id).filter(Boolean);
    if (interpreterIds.length) {
      const interpreters = await fastify.prisma.interpreter.findMany({
        where: { id: { in: interpreterIds } },
        select: { fcm_token: true },
      });
      const messages = interpreters
        .filter((i) => !!i.fcm_token)
        .map((i) => ({
          to: i.fcm_token!,
          title: "New appointment offer",
          body: `${dateStr}${clinicName ? ` · ${clinicName}` : ""}`,
          data: { type: "offer", appointment_id: id },
          sound: "default" as const,
          priority: "high" as const,
        }));
      void sendExpoPushNotifications(messages);
    }

    return reply.status(201).send(result);
  });

  // GET /appointments/activity — org-wide log (all entity types)
  fastify.get("/activity", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query);
    const payload = req.user as JwtPayload;
    const entries = await fastify.prisma.activityLog.findMany({
      where: { organization_id: payload.organization_id },
      orderBy: { created_at: "desc" },
      take: limit,
    });

    // Back-fill entity_name for appointment entries that were logged before
    // entity_name tracking was added (entity_name may be null for older rows).
    const missingIds = entries
      .filter((e) => e.entity_type === "appointment" && !e.entity_name)
      .map((e) => e.entity_id);

    let nameMap: Record<string, string> = {};
    if (missingIds.length > 0) {
      const appts = await fastify.prisma.appointment.findMany({
        where: { id: { in: missingIds }, organization_id: payload.organization_id },
        select: { id: true, patient: { select: { name: true } } },
      });
      nameMap = Object.fromEntries(appts.map((a) => [a.id, a.patient?.name ?? ""]));
    }

    const enriched = entries.map((e) =>
      e.entity_type === "appointment" && !e.entity_name && nameMap[e.entity_id]
        ? { ...e, entity_name: nameMap[e.entity_id] }
        : e,
    );

    return reply.send(enriched);
  });

  // GET /appointments/:id/activity
  fastify.get("/:id/activity", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getActivityLog(id, payload.organization_id, fastify.prisma));
  });

  // GET /appointments/:id/admin-notes
  fastify.get("/:id/admin-notes", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAdminNotes(id, payload.organization_id, fastify.prisma));
  });

  // POST /appointments/:id/admin-notes
  fastify.post("/:id/admin-notes", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { content } = z.object({ content: z.string().min(1).max(800) }).parse(req.body);
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    return reply.status(201).send(await addAdminNote(id, content, payload.organization_id, actor, fastify.prisma));
  });

  // POST /appointments/:id/offers/:offer_id/confirm
  fastify.post("/:id/offers/:offer_id/confirm", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id, offer_id } = req.params as { id: string; offer_id: string };
    const payload = req.user as JwtPayload;
    const result = await confirmOffer(id, offer_id, payload.sub, fastify.prisma);
    fastify.io.to(`notify:${payload.organization_id}`).emit("appointment:offer_updated", { appointmentId: id, status: "confirmed" });
    return reply.send(result);
  });

  // POST /appointments/:id/offers/:offer_id/decline
  fastify.post("/:id/offers/:offer_id/decline", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id, offer_id } = req.params as { id: string; offer_id: string };
    const payload = req.user as JwtPayload;
    const result = await declineOffer(id, offer_id, payload.sub, fastify.prisma);
    fastify.io.to(`notify:${payload.organization_id}`).emit("appointment:offer_updated", { appointmentId: id, status: "declined" });

    // Create admin alert for declined offer
    const [appt, interpreter] = await Promise.all([
      fastify.prisma.appointment.findUnique({
        where: { id },
        select: { date_time: true, po_number: true, patient: { select: { name: true } } },
      }),
      fastify.prisma.interpreter.findUnique({ where: { id: payload.sub }, select: { name: true } }),
    ]);
    const dateStr = appt ? new Date(appt.date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    const interpName = interpreter?.name ?? payload.name ?? "An interpreter";
    const patientStr = appt?.patient?.name ? `${appt.patient.name}` : "";
    const poStr = appt?.po_number ? `PO: ${appt.po_number}` : "";
    const apptRef = [patientStr, poStr].filter(Boolean).join(" — ");
    const alert = await fastify.prisma.adminAlert.create({
      data: {
        organization_id: payload.organization_id,
        type: "offer_declined",
        appointment_id: id,
        message: `${interpName} declined the offer for the ${dateStr} appointment${apptRef ? ` (${apptRef})` : ""}.`,
      },
    });
    fastify.io.to(`notify:${payload.organization_id}`).emit("alert:new", { alert });

    return reply.send(result);
  });

  // POST /appointments/:id/manual-confirm — admin manually assigns an interpreter (feature-flagged)
  fastify.post("/:id/manual-confirm", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { interpreter_id } = req.body as { interpreter_id: string };
    const payload = req.user as JwtPayload;

    const settings = await fastify.prisma.systemSettings.findUnique({
      where: { organization_id: payload.organization_id },
    });
    if (!settings?.allow_manual_confirm) {
      return reply.status(403).send({ error: { code: "FEATURE_DISABLED", message: "Manual confirm is not enabled" } });
    }

    return reply.send(await manualConfirmInterpreter(id, interpreter_id, payload.organization_id, fastify.prisma));
  });

  // POST /appointments/:id/unassign — admin removes interpreter and returns to pending_offer
  fastify.post("/:id/unassign", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const actor = await resolveActor(payload, fastify);
    await unassignInterpreter(id, payload.organization_id, actor, fastify.prisma);
    return reply.status(200).send({ success: true });
  });

  // POST /appointments/:id/clock-in
  fastify.post("/:id/clock-in", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    const { lat, lng } = z.object({
      lat: z.number().optional(),
      lng: z.number().optional(),
    }).parse(req.body ?? {});
    return reply.send(await clockIn(id, payload.sub, fastify.prisma, lat, lng));
  });

  // POST /appointments/:id/clock-out
  fastify.post("/:id/clock-out", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await clockOut(id, payload.sub, fastify.prisma));
  });

  // POST /appointments/:id/patient-arrived
  fastify.post("/:id/patient-arrived", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await markPatientArrived(id, payload.sub, fastify.prisma));
  });

  // POST /appointments/:id/notes
  fastify.post("/:id/notes", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = ShiftNotesBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await addShiftNotes(id, payload.sub, body, fastify.prisma));
  });

  // GET /appointments/me/:id  (interpreter's own appointment detail)
  fastify.get("/me/:id", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreterAppointment(id, payload.sub, fastify.prisma));
  });

  // GET /appointments/me/offers  (interpreter's pending offers)
  fastify.get("/me/offers", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreterOffers(payload.sub, fastify.prisma));
  });

  // GET /appointments/me/appointments  (interpreter's own)
  fastify.get("/me/appointments", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const query = z.object({
      status: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.coerce.number().default(25),
    }).parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await getInterpreterAppointments(payload.sub, query, fastify.prisma));
  });

  // POST /appointments/:id/follow-up
  fastify.post("/:id/follow-up", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = SubmitFollowUpBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await submitFollowUp(id, payload.sub, body, fastify.prisma));
  });

  // GET /appointments/:id/follow-up
  fastify.get("/:id/follow-up", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const response = await fastify.prisma.followUpResponse.findUnique({
      where: { appointment_id: id },
      include: { media: true },
    });
    if (!response) return reply.status(404).send({ error: { code: "NO_FOLLOW_UP_RESPONSE", message: "No follow-up response" } });
    return reply.send(response);
  });

  // PATCH /appointments/follow-up-drafts/:draft_id
  fastify.patch("/follow-up-drafts/:draft_id", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { draft_id } = req.params as { draft_id: string };
    const body = ReviewFollowUpDraftBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await reviewFollowUpDraft(draft_id, payload.organization_id, body, fastify.prisma));
  });

  // POST /appointments/:id/media  (interpreter uploads a photo)
  fastify.post("/:id/media", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;

    const data = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB limit
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });

    const ALLOWED = new Set(["image/jpeg", "image/png", "image/heic", "image/webp"]);
    if (!ALLOWED.has(data.mimetype)) {
      return reply.status(400).send({ error: { code: "INVALID_FILE_TYPE", message: "Only JPEG, PNG, HEIC and WebP images are accepted" } });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length > 5 * 1024 * 1024) {
      return reply.status(400).send({ error: { code: "FILE_TOO_LARGE", message: "File exceeds the 5 MB limit" } });
    }

    const ext = extname(data.filename || "") || (data.mimetype === "image/png" ? ".png" : data.mimetype === "image/webp" ? ".webp" : ".jpg");
    const filename = `${randomUUID()}${ext}`;

    // Local dev: save to uploads/; production: use GCS
    const __dirname = fileURLToPath(new URL(".", import.meta.url));
    const uploadsDir = join(__dirname, "..", "..", "..", "uploads", "appointment-media");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, filename), buffer);
    const publicUrl = `/uploads/appointment-media/${filename}`;

    const media = await uploadAppointmentMedia({
      appointmentId: id,
      interpreterId: payload.sub,
      organizationId: payload.organization_id,
      filename: data.filename || filename,
      mimeType: data.mimetype,
      fileSize: buffer.length,
      gcsPath: publicUrl,
      publicUrl,
      prisma: fastify.prisma,
    });

    return reply.status(201).send(media);
  });

  // GET /appointments/:id/media  (admin views uploaded media)
  fastify.get("/:id/media", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await getAppointmentMedia(id, payload.organization_id, fastify.prisma));
  });
}
