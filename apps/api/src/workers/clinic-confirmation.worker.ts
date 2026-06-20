import { Worker, Queue } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { redisConnection, config } from "../config.js";
import { sendEmail } from "../lib/email.js";
import { createClinicConfirmationToken } from "../lib/clinic-confirmation-token.js";
import { dateBoundsInTz } from "../lib/date-bounds.js";

const QUEUE_NAME = "clinic-confirmation";

export const clinicConfirmationQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

export function createClinicConfirmationWorker(prisma: PrismaClient) {
  return new Worker(
    QUEUE_NAME,
    async () => { await sendPendingConfirmations(prisma); },
    { connection: redisConnection, concurrency: 1 },
  );
}

/** Called from index.ts to register the repeatable poll-and-send job. */
export async function scheduleClinicConfirmationPolling() {
  await clinicConfirmationQueue.add(
    "poll",
    {},
    { repeat: { every: 5 * 60 * 1000 }, jobId: "clinic-confirmation-poll" },
  );
}

async function sendPendingConfirmations(prisma: PrismaClient) {
  const orgs = await prisma.organization.findMany({
    where: { is_active: true },
    select: { id: true },
  });

  for (const org of orgs) {
    await maybeSendForOrg(org.id, prisma);
  }
}

/** Force-sends confirmation emails for all orgs, bypassing the time window and dedup guard. For dev/testing only. */
export async function forceSendClinicConfirmations(prisma: PrismaClient) {
  const orgs = await prisma.organization.findMany({
    where: { is_active: true },
    select: { id: true },
  });
  for (const org of orgs) {
    await sendForOrg(org.id, prisma);
  }
}

async function maybeSendForOrg(organizationId: string, prisma: PrismaClient) {
  const settings = await prisma.systemSettings.findUnique({ where: { organization_id: organizationId } });
  if (!settings?.clinic_confirmation_enabled) return;

  const tz = settings.timezone ?? "America/Los_Angeles";
  const sendTime = settings.clinic_confirmation_time ?? "08:00"; // "HH:MM"

  // Current time in org timezone
  const nowParts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const nowHH = parseInt(nowParts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const nowMM = parseInt(nowParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const [sendHH, sendMM] = sendTime.split(":").map(Number);

  // Only fire within the 5-minute window after the configured send time
  const nowMinutes = nowHH * 60 + nowMM;
  const sendMinutes = sendHH * 60 + sendMM;
  if (nowMinutes < sendMinutes || nowMinutes >= sendMinutes + 5) return;

  // Today's date in org timezone as "YYYY-MM-DD"
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  if (settings.clinic_confirmation_last_sent_date === todayStr) return; // already sent today

  await sendForOrg(organizationId, prisma);
}

async function sendForOrg(organizationId: string, prisma: PrismaClient) {
  const settings = await prisma.systemSettings.findUnique({ where: { organization_id: organizationId } });
  if (!settings?.clinic_confirmation_enabled) return;

  const tz = settings.timezone ?? "America/Los_Angeles";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  // Determine the date window — Friday expands to cover Sat/Sun/Mon
  const todayDow = new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long" });
  const isFriday = todayDow === "Friday";

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // always tomorrow (Saturday on Friday)

  const endDate = new Date(startDate);
  if (isFriday) endDate.setDate(endDate.getDate() + 2); // Saturday + 2 = Monday

  const startDateStr = startDate.toLocaleDateString("en-CA", { timeZone: tz });
  const endDateStr = endDate.toLocaleDateString("en-CA", { timeZone: tz });

  const fmtFull = (d: Date) => d.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  const dateRangeLabel = isFriday
    ? `${fmtFull(startDate)} – ${fmtFull(endDate)}`
    : fmtFull(startDate);

  const [queryStart] = dateBoundsInTz(startDateStr, tz);
  const [, queryEnd] = dateBoundsInTz(endDateStr, tz);

  const orgLanguages = await prisma.organizationLanguage.findMany({
    where: { organization_id: organizationId },
    select: { code: true, name: true },
  });
  const languageNames = new Map(orgLanguages.map((l) => [l.code, l.name]));

  const appointments = await prisma.appointment.findMany({
    where: {
      organization_id: organizationId,
      date_time: { gte: queryStart, lte: queryEnd },
      status: { notIn: ["cancelled"] },
    },
    include: {
      clinic: { select: { id: true, name: true, primary_contact_email: true } },
      patient: { select: { name: true } },
      interpreter: { select: { name: true } },
    },
    orderBy: { date_time: "asc" },
  });

  // Group by clinic
  const byClinic = new Map<string, typeof appointments>();
  for (const appt of appointments) {
    const clinicId = appt.clinic_id;
    if (!byClinic.has(clinicId)) byClinic.set(clinicId, []);
    byClinic.get(clinicId)!.push(appt);
  }

  let emailsSent = 0;
  for (const [clinicId, appts] of byClinic) {
    const clinic = appts[0].clinic;
    if (!clinic?.primary_contact_email) continue;

    const token = createClinicConfirmationToken(organizationId, clinicId, startDateStr, endDateStr, config.JWT_SECRET);
    const apiBase = (config.API_URL ?? config.APP_URL.replace(/app\./, "api.")).replace(/\/$/, "");
    const confirmUrl = `${apiBase}/api/v1/clinic-confirmation/confirm?token=${encodeURIComponent(token)}`;

    const email = buildConfirmationEmail(clinic.name, dateRangeLabel, appts, confirmUrl, tz, settings.organization_name ?? null, languageNames, isFriday, fmtShort);
    await sendEmail({ to: clinic.primary_contact_email, ...email });
    emailsSent++;
  }

  // Only stamp the sent date if we actually sent something
  if (emailsSent > 0) {
    await prisma.systemSettings.update({
      where: { organization_id: organizationId },
      data: { clinic_confirmation_last_sent_date: todayStr },
    });
  }
}

function buildConfirmationEmail(
  clinicName: string,
  dateLabel: string,
  appts: Array<{ date_time: Date; patient: { name: string } | null; language: string; interpreter_type_required: string; referring_physician: string | null; interpreter: { name: string } | null }>,
  confirmUrl: string,
  tz: string,
  orgName: string | null,
  languageNames: Map<string, string>,
  multiDay: boolean,
  fmtShort: (d: Date) => string,
): { subject: string; html: string; text: string } {
  const subject = `Appointment confirmation for ${dateLabel} — ${clinicName}`;

  const rows = appts.map((a) => {
    const timeStr = a.date_time.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    const timeCell = multiDay ? `${fmtShort(a.date_time)}, ${timeStr}` : timeStr;
    const patient = a.patient?.name ?? "—";
    const language = languageNames.get(a.language) ?? a.language;
    const provider = a.referring_physician ?? "—";
    const interpreter = a.interpreter?.name ?? "TBD";
    return `
      <tr style="border-bottom:1px solid #e4e4e7;">
        <td style="padding:10px 12px;font-size:14px;color:#18181b;white-space:nowrap;">${timeCell}</td>
        <td style="padding:10px 12px;font-size:14px;color:#18181b;">${patient}</td>
        <td style="padding:10px 12px;font-size:14px;color:#52525b;">${language}</td>
        <td style="padding:10px 12px;font-size:14px;color:#52525b;min-width:160px;">${provider}</td>
        <td style="padding:10px 12px;font-size:14px;color:#52525b;">${interpreter}</td>
      </tr>`;
  }).join("");

  const textRows = appts.map((a) => {
    const timeStr = a.date_time.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    const timeCell = multiDay ? `${fmtShort(a.date_time)}, ${timeStr}` : timeStr;
    const language = languageNames.get(a.language) ?? a.language;
    return `  ${timeCell} | ${a.patient?.name ?? "—"} | ${language} | ${a.referring_physician ?? "—"} | ${a.interpreter?.name ?? "TBD"}`;
  }).join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#18181b;padding:28px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${orgName ?? "Dorada"}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 24px;">
              <h2 style="margin:0 0 6px;color:#18181b;font-size:18px;font-weight:600;">Appointment Confirmation</h2>
              <p style="margin:0 0 20px;color:#52525b;font-size:14px;">${clinicName} &mdash; ${dateLabel}</p>
              <p style="margin:0 0 20px;color:#52525b;font-size:15px;line-height:1.6;">
                ${multiDay
                  ? "Please review the following appointments scheduled at your clinic for this weekend and Monday:"
                  : "Please review the following appointments scheduled for tomorrow at your clinic:"}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                <thead>
                  <tr style="background-color:#f4f4f5;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Time</th>
                    <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Patient</th>
                    <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Language</th>
                    <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;min-width:160px;">Provider</th>
                    <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Interpreter</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#16a34a;border-radius:6px;">
                    <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      ✓ &nbsp;Yes, confirmed
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#52525b;font-size:14px;line-height:1.6;">
                If there are any appointments in this list that are not confirmed please reply to this email with the updates. Thank you!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:13px;">This email was sent by ${orgName ?? "Dorada"} on behalf of your interpretation services provider.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Appointment Confirmation — ${clinicName} — ${dateLabel}\n\nPlease review tomorrow's appointments:\n\n${textRows}\n\nTo confirm all appointments, visit:\n${confirmUrl}\n\nIf there are any appointments in this list that are not confirmed please reply to this email with the updates. Thank you!`;

  return { subject, html, text };
}
