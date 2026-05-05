import type { FastifyInstance } from "fastify";
import {
  AppointmentListQuerySchema,
  CreateAppointmentBodySchema,
  UpdateAppointmentBodySchema,
  OfferAppointmentBodySchema,
  ShiftNotesBodySchema,
  SubmitFollowUpBodySchema,
  ReviewFollowUpDraftBodySchema,
} from "@pulpito/types";
import { z } from "zod";
import { authenticate, authenticateAdmin, authenticateInterpreter } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
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
  addShiftNotes,
  getInterpreterAppointments,
  submitFollowUp,
  listFollowUpDrafts,
  reviewFollowUpDraft,
} from "./appointments.service.js";

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
    return reply.status(201).send(await createAppointment(body, payload.organization_id, fastify.prisma));
  });

  // PATCH /appointments/:id
  fastify.patch("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateAppointmentBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await updateAppointment(id, body, payload.organization_id, fastify.prisma));
  });

  // DELETE /appointments/:id
  fastify.delete("/:id", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    await cancelAppointment(id, payload.organization_id, fastify.prisma);
    return reply.status(204).send();
  });

  // POST /appointments/:id/offers
  fastify.post("/:id/offers", { preHandler: [authenticateAdmin, requirePermission("manage_appointments")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = OfferAppointmentBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.status(201).send(await offerAppointment(id, body, payload.organization_id, fastify.prisma));
  });

  // POST /appointments/:id/offers/:offer_id/confirm
  fastify.post("/:id/offers/:offer_id/confirm", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id, offer_id } = req.params as { id: string; offer_id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await confirmOffer(id, offer_id, payload.sub, fastify.prisma));
  });

  // POST /appointments/:id/offers/:offer_id/decline
  fastify.post("/:id/offers/:offer_id/decline", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id, offer_id } = req.params as { id: string; offer_id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await declineOffer(id, offer_id, payload.sub, fastify.prisma));
  });

  // POST /appointments/:id/clock-in
  fastify.post("/:id/clock-in", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await clockIn(id, payload.sub, fastify.prisma));
  });

  // POST /appointments/:id/clock-out
  fastify.post("/:id/clock-out", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = req.user as JwtPayload;
    return reply.send(await clockOut(id, payload.sub, fastify.prisma));
  });

  // POST /appointments/:id/notes
  fastify.post("/:id/notes", { preHandler: authenticateInterpreter }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = ShiftNotesBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    return reply.send(await addShiftNotes(id, payload.sub, body, fastify.prisma));
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
}
