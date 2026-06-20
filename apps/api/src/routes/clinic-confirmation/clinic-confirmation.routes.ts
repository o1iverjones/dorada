import type { FastifyInstance } from "fastify";
import { verifyClinicConfirmationToken } from "../../lib/clinic-confirmation-token.js";
import { config } from "../../config.js";
import { dateBoundsInTz } from "../../lib/date-bounds.js";

function page(opts: {
  icon: string;
  heading: string;
  body: string;
  contactEmail: string | null;
  contactPhone: string | null;
  orgName: string | null;
}) {
  const contactLine = opts.contactEmail || opts.contactPhone
    ? `<p style="margin:16px 0 0;color:#52525b;font-size:14px;">If you have any questions, please contact us at${
        opts.contactEmail ? ` <a href="mailto:${opts.contactEmail}" style="color:#18181b;font-weight:600;">${opts.contactEmail}</a>` : ""
      }${opts.contactEmail && opts.contactPhone ? " or" : ""}${
        opts.contactPhone ? ` <strong>${opts.contactPhone}</strong>` : ""
      }.</p>`
    : "";

  const displayName = opts.orgName ?? "Dorada";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.heading} — ${displayName}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; max-width: 480px; width: 90%; text-align: center; }
    .header { background: #18181b; padding: 24px 40px; }
    .header h2 { margin: 0; color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .body { padding: 40px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0; color: #52525b; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h2>${displayName}</h2></div>
    <div class="body">
      <div class="icon">${opts.icon}</div>
      <h1>${opts.heading}</h1>
      <p>${opts.body}</p>
      ${contactLine}
    </div>
  </div>
</body>
</html>`;
}

export default async function clinicConfirmationRoutes(fastify: FastifyInstance) {
  fastify.get("/confirm", async (req, reply) => {
    const { token } = req.query as { token?: string };

    if (!token) {
      return reply.type("text/html").status(400).send(page({
        icon: "⚠️",
        heading: "Link issue",
        body: "Invalid or missing confirmation link.",
        contactEmail: null,
        contactPhone: null,
        orgName: null,
      }));
    }

    const parsed = verifyClinicConfirmationToken(token, config.JWT_SECRET);
    if (!parsed) {
      return reply.type("text/html").status(400).send(page({
        icon: "⚠️",
        heading: "Link issue",
        body: "This confirmation link is invalid or has been tampered with.",
        contactEmail: null,
        contactPhone: null,
        orgName: null,
      }));
    }

    const { orgId, clinicId, startDate, endDate } = parsed;

    // Load org settings (contact info, name, timezone)
    const settings = await fastify.prisma.systemSettings.findUnique({
      where: { organization_id: orgId },
      select: { contact_email: true, contact_phone: true, timezone: true, organization_name: true },
    });
    const contactEmail = settings?.contact_email ?? null;
    const contactPhone = settings?.contact_phone ?? null;
    const orgName = settings?.organization_name ?? null;
    const tz = settings?.timezone ?? "America/Los_Angeles";

    const [queryStart] = dateBoundsInTz(startDate, tz);
    const [, queryEnd] = dateBoundsInTz(endDate, tz);

    // Check if already confirmed
    const alreadyConfirmed = await fastify.prisma.appointment.count({
      where: {
        organization_id: orgId,
        clinic_id: clinicId,
        date_time: { gte: queryStart, lte: queryEnd },
        status: { notIn: ["cancelled"] },
        clinic_confirmed: true,
      },
    });

    if (alreadyConfirmed > 0) {
      return reply.type("text/html").send(page({
        icon: "ℹ️",
        heading: "Confirmation already received",
        body: "We already have your confirmation on file for these appointments. No further action is needed.",
        contactEmail,
        contactPhone,
        orgName,
      }));
    }

    const result = await fastify.prisma.appointment.updateMany({
      where: {
        organization_id: orgId,
        clinic_id: clinicId,
        date_time: { gte: queryStart, lte: queryEnd },
        status: { notIn: ["cancelled"] },
      },
      data: { clinic_confirmed: true },
    });

    fastify.log.info({ orgId, clinicId, startDate, endDate, updated: result.count }, "Clinic confirmed appointments");

    return reply.type("text/html").send(page({
      icon: "✅",
      heading: "Thank you for confirming!",
      body: `All ${result.count} appointment${result.count === 1 ? "" : "s"} have been confirmed.`,
      contactEmail,
      contactPhone,
      orgName,
    }));
  });
}
