import { Worker, Queue, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
// firebase-admin and twilio are optional runtime dependencies; use `any` to avoid compile-time errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirebaseApp = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwilioClient = any;
import { config, redisConnection } from "../config.js";

interface FollowUpPromptJobData {
  type: "initial_prompt" | "reminder";
  appointmentId: string;
  organizationId: string;
  interpreterId: string;
  attempt: number;
}

const followUpQueue = new Queue("follow-up-flow", {
  connection: redisConnection,
});

export function createFollowUpFlowWorker(
  prisma: PrismaClient,
  fcmApp: FirebaseApp,
  twilioClient: TwilioClient,
) {
  return new Worker<FollowUpPromptJobData>(
    "follow-up-flow",
    async (job: Job<FollowUpPromptJobData>) => {
      const { appointmentId, organizationId, interpreterId, attempt } = job.data;

      const [appointment, interpreter, settings] = await Promise.all([
        prisma.appointment.findUnique({ where: { id: appointmentId } }),
        prisma.interpreter.findUnique({ where: { id: interpreterId } }),
        prisma.systemSettings.findUnique({ where: { organization_id: organizationId } }),
      ]);

      if (!appointment || appointment.organization_id !== organizationId) return;
      if (!interpreter) return;

      // Check if follow-up response already exists — stop if answered
      const existingResponse = await prisma.followUpResponse.findFirst({
        where: { appointment_id: appointmentId },
      });
      if (existingResponse) return;

      const maxReminders = settings?.follow_up_max_reminders ?? 2;

      if (attempt > maxReminders) {
        // Mark as no_response
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { follow_up_status: "no_response" },
        });
        return;
      }

      const channel = interpreter.follow_up_channel ?? "push";

      if (channel === "sms" && interpreter.phone) {
        await twilioClient.messages.create({
          to: interpreter.phone,
          from: config.TWILIO_FROM_NUMBER,
          body: "Did your patient have a follow-up appointment? Reply YES or NO.",
        });
      } else if (interpreter.fcm_token) {
        await fcmApp.messaging().send({
          token: interpreter.fcm_token,
          data: {
            type: "follow_up_prompt",
            appointment_id: appointmentId,
          },
          notification: {
            title: "Follow-up Question",
            body: "Did your patient have a follow-up appointment scheduled?",
          },
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        });
      }

      // Schedule next reminder if within limit
      if (attempt < maxReminders) {
        const reminderWindowMs = (settings?.follow_up_reminder_window_minutes ?? 60) * 60 * 1000;
        await followUpQueue.add(
          "follow-up-prompt",
          {
            type: "reminder",
            appointmentId,
            organizationId,
            interpreterId,
            attempt: attempt + 1,
          } satisfies FollowUpPromptJobData,
          {
            delay: reminderWindowMs,
            jobId: `follow-up:${appointmentId}:attempt:${attempt + 1}`,
          },
        );
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );
}

export async function enqueueFollowUpPrompt(
  appointmentId: string,
  organizationId: string,
  interpreterId: string,
  queue: import("bullmq").Queue,
) {
  await queue.add(
    "follow-up-prompt",
    {
      type: "initial_prompt",
      appointmentId,
      organizationId,
      interpreterId,
      attempt: 0,
    } satisfies FollowUpPromptJobData,
    { jobId: `follow-up:${appointmentId}:attempt:0` },
  );
}
