import type { FastifyInstance } from "fastify";
import { verifyClinicConfirmationToken } from "../../lib/clinic-confirmation-token.js";
import { config } from "../../config.js";

const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Appointments Confirmed — Dorada</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 48px 40px; max-width: 480px; width: 90%; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0; color: #52525b; font-size: 15px; line-height: 1.6; }
    .brand { margin-top: 32px; color: #a1a1aa; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Appointments confirmed!</h1>
    <p>All appointments in today's list have been marked as confirmed. Thank you for your prompt response.</p>
    <p class="brand">Dorada</p>
  </div>
</body>
</html>`;

const errorHtml = (message: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmation Error — Dorada</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 48px 40px; max-width: 480px; width: 90%; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0; color: #52525b; font-size: 15px; line-height: 1.6; }
    .brand { margin-top: 32px; color: #a1a1aa; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Link issue</h1>
    <p>${message}</p>
    <p class="brand">Dorada</p>
  </div>
</body>
</html>`;

export default async function clinicConfirmationRoutes(fastify: FastifyInstance) {
  fastify.get("/confirm", async (req, reply) => {
    const { token } = req.query as { token?: string };

    if (!token) {
      return reply.type("text/html").status(400).send(errorHtml("Invalid or missing confirmation link."));
    }

    const parsed = verifyClinicConfirmationToken(token, config.JWT_SECRET);
    if (!parsed) {
      return reply.type("text/html").status(400).send(errorHtml("This confirmation link is invalid or has been tampered with."));
    }

    const { orgId, clinicId, date } = parsed;

    // Mark all appointments for this clinic on this date as clinic_confirmed
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${date}T23:59:59.999Z`);

    const result = await fastify.prisma.appointment.updateMany({
      where: {
        organization_id: orgId,
        clinic_id: clinicId,
        date_time: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["cancelled"] },
      },
      data: { clinic_confirmed: true },
    });

    fastify.log.info({ orgId, clinicId, date, updated: result.count }, "Clinic confirmed appointments");

    return reply.type("text/html").send(successHtml);
  });
}
