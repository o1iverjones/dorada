import { Worker, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { redisConnection } from "../config.js";
import { sendExpoPushNotifications } from "../lib/push.js";

interface ReminderJobData {
  appointmentId: string;
  organizationId: string;
  label: string;
}

export function createAppointmentRemindersWorker(prisma: PrismaClient) {
  return new Worker<ReminderJobData>(
    "appointment-reminders",
    async (job: Job<ReminderJobData>) => {
      const { appointmentId, organizationId, label } = job.data;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          interpreter: { select: { fcm_token: true, name: true } },
          patient: { select: { name: true } },
        },
      });

      if (!appointment || appointment.organization_id !== organizationId) return;
      if (appointment.status !== "confirmed") return;
      if (!appointment.interpreter?.fcm_token) return;

      const dateStr = new Date(appointment.date_time).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });

      await sendExpoPushNotifications([{
        to: appointment.interpreter.fcm_token,
        title: `Appointment reminder — ${label}`,
        body: `You have an appointment on ${dateStr}${appointment.patient ? ` with ${appointment.patient.name}` : ""}.`,
        data: { type: "appointment_reminder", appointment_id: appointmentId },
        sound: "default",
        priority: "high",
      }]);
    },
    {
      connection: redisConnection,
      concurrency: 10,
    },
  );
}

export async function scheduleRemindersForAppointment(
  appointmentId: string,
  organizationId: string,
  appointmentDatetime: Date,
  prisma: PrismaClient,
  queue: import("bullmq").Queue,
) {
  // Cancel any existing reminders first (idempotent)
  await cancelRemindersForAppointment(appointmentId, prisma, queue);

  const configs = await prisma.appointmentReminderConfig.findMany({
    where: { organization_id: organizationId, is_active: true },
  });

  const now = Date.now();
  const apptTime = appointmentDatetime.getTime();

  for (const config of configs) {
    const delay = apptTime - config.offset_minutes * 60 * 1000 - now;
    if (delay > 0) {
      await queue.add(
        "reminder",
        { appointmentId, organizationId, label: config.label } satisfies ReminderJobData,
        { delay, jobId: `reminder:${appointmentId}:${config.id}` },
      );
    }
  }
}

export async function cancelRemindersForAppointment(
  appointmentId: string,
  prisma: PrismaClient,
  queue: import("bullmq").Queue,
) {
  const configs = await prisma.appointmentReminderConfig.findMany({
    where: { is_active: true },
    select: { id: true },
  });
  await Promise.all(
    configs.map((c) => queue.remove(`reminder:${appointmentId}:${c.id}`)),
  );
}
