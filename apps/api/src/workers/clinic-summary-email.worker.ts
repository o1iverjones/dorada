import { Worker, Queue } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { redisConnection } from "../config.js";
import { sendEmail } from "../lib/email.js";
import { dateBoundsInTz } from "../lib/date-bounds.js";

const QUEUE_NAME = "clinic-summary-email";

export const clinicSummaryEmailQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

export function createClinicSummaryEmailWorker(prisma: PrismaClient) {
  return new Worker(
    QUEUE_NAME,
    async () => { await sendPendingSummaryEmails(prisma); },
    { connection: redisConnection, concurrency: 1 },
  );
}

export async function scheduleClinicSummaryEmailPolling() {
  await clinicSummaryEmailQueue.add(
    "poll",
    {},
    { repeat: { every: 60 * 60 * 1000 }, jobId: "clinic-summary-email-poll" },
  );
}

async function sendPendingSummaryEmails(prisma: PrismaClient) {
  const orgs = await prisma.organization.findMany({
    where: { is_active: true },
    select: { id: true },
  });

  for (const org of orgs) {
    await maybeSendForOrg(org.id, prisma);
  }
}

async function maybeSendForOrg(organizationId: string, prisma: PrismaClient) {
  const settings = await prisma.systemSettings.findUnique({ where: { organization_id: organizationId } });
  if (!settings?.clinic_summary_emails_enabled) return;

  const tz = settings.timezone ?? "America/Los_Angeles";
  const sendTime = settings.clinic_summary_emails_time ?? "08:00";

  // Only fire within the 60-minute window after the configured send time
  const nowParts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const nowHH = parseInt(nowParts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const nowMM = parseInt(nowParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const [sendHH, sendMM] = sendTime.split(":").map(Number);
  const nowMinutes = nowHH * 60 + nowMM;
  const sendMinutes = sendHH * 60 + sendMM;
  if (nowMinutes < sendMinutes || nowMinutes >= sendMinutes + 60) return;

  // Today's date string in org timezone
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  // Day of week in org timezone (0=Sun ... 6=Sat)
  const todayDow = new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "short" });
  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayDowIndex = DOW_MAP[todayDow];
  if (todayDowIndex === undefined) return;

  // Find clinics with summary emails enabled for today's day-of-week
  const clinics = await prisma.clinic.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      summary_emails_enabled: true,
    },
    select: {
      id: true,
      name: true,
      primary_contact_email: true,
      summary_email_days: true,
      summary_email_last_sent_date: true,
    },
  });

  const eligibleClinics = clinics.filter(
    (c) =>
      c.summary_email_days.includes(todayDowIndex) &&
      c.summary_email_last_sent_date !== todayStr &&
      c.primary_contact_email,
  );

  if (eligibleClinics.length === 0) return;

  // "Upcoming week" = tomorrow through 7 days from now
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });

  const weekLater = new Date(tomorrow);
  weekLater.setDate(weekLater.getDate() + 6);
  const weekLaterStr = weekLater.toLocaleDateString("en-CA", { timeZone: tz });

  const [windowStart] = dateBoundsInTz(tomorrowStr, tz);
  const [, windowEnd] = dateBoundsInTz(weekLaterStr, tz);

  for (const clinic of eligibleClinics) {
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        clinic_id: clinic.id,
        date_time: { gte: windowStart, lte: windowEnd },
        status: { notIn: ["cancelled"] },
      },
      include: {
        patient: { select: { name: true, date_of_birth: true } },
        interpreter: { select: { name: true } },
      },
      orderBy: { date_time: "asc" },
    });

    if (appointments.length === 0) continue;

    // Mark as sent before sending to prevent double-send
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { summary_email_last_sent_date: todayStr },
    });

    const weekLabel = buildWeekLabel(tomorrowStr, weekLaterStr, tz);
    const email = buildSummaryEmail(clinic.name, weekLabel, appointments, tz);
    await sendEmail({ to: clinic.primary_contact_email!, ...email });
  }
}

function buildWeekLabel(fromStr: string, toStr: string, tz: string): string {
  const from = new Date(`${fromStr}T12:00:00.000Z`);
  const to = new Date(`${toStr}T12:00:00.000Z`);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { timeZone: tz, month: "long", day: "numeric", year: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

function buildSummaryEmail(
  clinicName: string,
  weekLabel: string,
  appts: Array<{
    date_time: Date;
    po_number: string | null;
    referring_physician: string | null;
    patient: { name: string; date_of_birth: Date | null } | null;
    interpreter: { name: string } | null;
  }>,
  tz: string,
): { subject: string; html: string; text: string } {
  const subject = `Appointment summary for ${weekLabel} — ${clinicName}`;

  const rows = appts.map((a) => {
    const dateTime = a.date_time.toLocaleDateString("en-US", {
      timeZone: tz, weekday: "short", month: "short", day: "numeric",
    }) + " " + a.date_time.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    const patient = a.patient?.name ?? "—";
    const dob = a.patient?.date_of_birth
      ? a.patient.date_of_birth.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
      : "—";
    const po = a.po_number ?? "—";
    const provider = a.referring_physician ?? "—";
    const interpreter = a.interpreter?.name ?? "TBD";
    return `
      <tr style="border-bottom:1px solid #e4e4e7;">
        <td style="padding:10px 12px;font-size:13px;color:#18181b;white-space:nowrap;">${dateTime}</td>
        <td style="padding:10px 12px;font-size:13px;color:#18181b;">${patient}</td>
        <td style="padding:10px 12px;font-size:13px;color:#52525b;white-space:nowrap;">${dob}</td>
        <td style="padding:10px 12px;font-size:13px;color:#52525b;">${po}</td>
        <td style="padding:10px 12px;font-size:13px;color:#52525b;">${provider}</td>
        <td style="padding:10px 12px;font-size:13px;color:#52525b;">${interpreter}</td>
      </tr>`;
  }).join("");

  const textRows = appts.map((a) => {
    const dateTime = a.date_time.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
      + " " + a.date_time.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    const dob = a.patient?.date_of_birth
      ? a.patient.date_of_birth.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
      : "—";
    return `  ${dateTime} | ${a.patient?.name ?? "—"} | DOB: ${dob} | PO: ${a.po_number ?? "—"} | ${a.referring_physician ?? "—"} | ${a.interpreter?.name ?? "TBD"}`;
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
        <table width="660" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#18181b;padding:28px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Dorada</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 24px;">
              <h2 style="margin:0 0 6px;color:#18181b;font-size:18px;font-weight:600;">Appointment Summary</h2>
              <p style="margin:0 0 20px;color:#52525b;font-size:14px;">${clinicName} &mdash; ${weekLabel}</p>
              <p style="margin:0 0 20px;color:#52525b;font-size:15px;line-height:1.6;">
                Here is a summary of upcoming appointments scheduled at your clinic for the week ahead:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;margin-bottom:28px;">
                <thead>
                  <tr style="background-color:#f4f4f5;">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Date &amp; Time</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Patient</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">DOB</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">PO#</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Provider</th>
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Interpreter</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <p style="margin:0;color:#52525b;font-size:14px;line-height:1.6;">
                If you have any questions about these appointments, please reply to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:13px;">This email was sent by Dorada on behalf of your interpretation services provider.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Appointment Summary — ${clinicName} — ${weekLabel}\n\nUpcoming appointments for the week ahead:\n\n${textRows}\n\nIf you have any questions about these appointments, please reply to this email.`;

  return { subject, html, text };
}
