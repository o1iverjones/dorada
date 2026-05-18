import { Worker, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
// firebase-admin is an optional runtime dependency; use `any` to avoid compile-time errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirebaseApp = any;
import { redisConnection } from "../config.js";

interface ReminderJobData {
  appointmentId: string;
  organizationId: string;
  offsetLabel: "24h" | "30min";
}

export function createAppointmentRemindersWorker(
  prisma: PrismaClient,
  fcmApp: FirebaseApp,
) {
  return new Worker<ReminderJobData>(
    "appointment-reminders",
    async (job: Job<ReminderJobData>) => {
      const { appointmentId, organizationId, offsetLabel } = job.data;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { interpreter: true },
      });

      if (!appointment || appointment.organization_id !== organizationId) return;
      if (appointment.status !== "confirmed") return;
      if (!appointment.interpreter) return;

      const fcmToken = appointment.interpreter.fcm_token;
      if (!fcmToken) return;

      const titleKey = offsetLabel === "24h" ? "reminder_24h_title" : "reminder_30min_title";
      const bodyKey = offsetLabel === "24h" ? "reminder_24h_body" : "reminder_30min_body";

      await fcmApp.messaging().send({
        token: fcmToken,
        notification: {
          title: titleKey,
          body: bodyKey,
        },
        data: {
          type: "appointment_reminder",
          appointment_id: appointmentId,
          offset: offsetLabel,
        },
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });
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
  queue: import("bullmq").Queue,
) {
  const now = Date.now();
  const apptTime = appointmentDatetime.getTime();

  const delay24h = apptTime - 24 * 60 * 60 * 1000 - now;
  const delay30min = apptTime - 30 * 60 * 1000 - now;

  if (delay24h > 0) {
    await queue.add(
      "reminder",
      { appointmentId, organizationId, offsetLabel: "24h" } satisfies ReminderJobData,
      { delay: delay24h, jobId: `reminder:${appointmentId}:24h` },
    );
  }
  if (delay30min > 0) {
    await queue.add(
      "reminder",
      { appointmentId, organizationId, offsetLabel: "30min" } satisfies ReminderJobData,
      { delay: delay30min, jobId: `reminder:${appointmentId}:30min` },
    );
  }
}

export async function cancelRemindersForAppointment(
  appointmentId: string,
  queue: import("bullmq").Queue,
) {
  await Promise.all([
    queue.remove(`reminder:${appointmentId}:24h`),
    queue.remove(`reminder:${appointmentId}:30min`),
  ]);
}
