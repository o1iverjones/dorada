import { Worker, Queue, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { Emitter } from "@socket.io/redis-emitter";
import { redisConnection } from "../config.js";

const QUEUE_NAME = "admin-alert";
export const adminAlertQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

export async function scheduleAdminAlertPolling() {
  await adminAlertQueue.add(
    "stale-billing-check",
    {},
    { repeat: { every: 60 * 60 * 1000 }, jobId: "stale-billing-check" },
  );
}

interface LongAppointmentJobData {
  appointmentId: string;
  organizationId: string;
  alertMinutes: number;
}

export function createAdminAlertWorker(prisma: PrismaClient) {
  const emitter = new Emitter(redisConnection as unknown as ConstructorParameters<typeof Emitter>[0]);

  return new Worker<LongAppointmentJobData>(
    QUEUE_NAME,
    async (job: Job<LongAppointmentJobData>) => {
      if (job.name === "stale-billing-check") {
        await runStaleBillingCheck(prisma, emitter);
        return;
      }
      if (job.name !== "long-appointment") return;

      const { appointmentId, organizationId, alertMinutes } = job.data;

      // Only alert if appointment is still in progress (not clocked out)
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, clock_out_time: true, date_time: true, po_number: true },
      });

      if (!appt || appt.clock_out_time || appt.status === "completed") return;

      // Deduplicate — skip if an alert was already created directly from the route handler
      const existing = await prisma.adminAlert.findFirst({
        where: { appointment_id: appointmentId, type: "long_appointment" },
      });
      if (existing) return;

      const hours = Math.floor(alertMinutes / 60);
      const mins = alertMinutes % 60;
      const durationStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      const dateStr = new Date(appt.date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const poStr = appt.po_number ? ` (PO: ${appt.po_number})` : "";

      const alert = await prisma.adminAlert.create({
        data: {
          organization_id: organizationId,
          type: "long_appointment",
          appointment_id: appointmentId,
          message: `The ${dateStr} appointment${poStr} has exceeded ${durationStr} and is still in progress.`,
        },
      });

      emitter.to(`notify:${organizationId}`).emit("alert:new", { alert });
    },
    {
      connection: redisConnection,
      concurrency: 20,
    },
  );
}

async function runStaleBillingCheck(prisma: PrismaClient, emitter: Emitter) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 40);

  // Find appointments older than 40 days that are billed or invoiced but not yet paid.
  // Payment status is filtered in JS (not SQL) because Prisma's { not: "paid" } generates
  // != 'paid' in SQL which silently excludes NULL rows (SQL NULL != 'paid' = NULL, not TRUE).
  const candidates = await prisma.appointment.findMany({
    where: {
      date_time: { lt: cutoff },
      OR: [{ billing_billed: true }, { billing_invoiced: true }],
      status: { notIn: ["cancelled"] },
    },
    select: {
      id: true,
      organization_id: true,
      date_time: true,
      po_number: true,
      billing_billed: true,
      billing_invoiced: true,
      billing_payment_status: true,
      patient: { select: { name: true } },
      clinic: { select: { name: true } },
    },
  });

  const stale = candidates.filter((a) => a.billing_payment_status !== "paid");

  for (const appt of stale) {
    // One alert per appointment — skip if one already exists
    const existing = await prisma.adminAlert.findFirst({
      where: { appointment_id: appt.id, type: "stale_billing" },
    });
    if (existing) continue;

    const dateStr = new Date(appt.date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const poStr = appt.po_number ? ` — PO: ${appt.po_number}` : "";
    const patientStr = appt.patient?.name ? ` for ${appt.patient.name}` : "";
    const clinicStr = appt.clinic?.name ? ` at ${appt.clinic.name}` : "";
    const flags = [appt.billing_billed && "Billed", appt.billing_invoiced && "Invoiced"].filter(Boolean).join(" / ");

    const alert = await prisma.adminAlert.create({
      data: {
        organization_id: appt.organization_id,
        type: "stale_billing",
        appointment_id: appt.id,
        message: `${flags} appointment from ${dateStr}${patientStr}${clinicStr}${poStr} is over 40 days old. Please review and send the relevant bill or invoice.`,
      },
    });

    emitter.to(`notify:${appt.organization_id}`).emit("alert:new", { alert });
  }
}
