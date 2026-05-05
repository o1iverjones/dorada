import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import admin from "firebase-admin";
import twilio from "twilio";
import sgMail from "@sendgrid/mail";
import { config } from "../config.js";
import { createAppointmentRemindersWorker } from "./appointment-reminders.worker.js";
import { createFollowUpFlowWorker } from "./follow-up-flow.worker.js";
import { createReportGenerationWorker } from "./report-generation.worker.js";
import { createEmailIntakeWorker } from "./email-intake.worker.js";

const prisma = new PrismaClient();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: config.GCP_PROJECT_ID,
  });
}
const fcmApp = admin.app();

const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
sgMail.setApiKey(config.SENDGRID_API_KEY);

const reminderWorker = createAppointmentRemindersWorker(prisma, fcmApp);
const followUpWorker = createFollowUpFlowWorker(prisma, fcmApp, twilioClient);
const reportWorker = createReportGenerationWorker(prisma);
const emailIntakeWorker = createEmailIntakeWorker(prisma, fcmApp);

const connection = { host: config.REDIS_HOST, port: config.REDIS_PORT };
const emailIntakeQueue = new Queue("email-intake", { connection });

// Kick off repeatable inbox-poll jobs for all active orgs at startup
async function scheduleEmailPolling() {
  const superSettings = await prisma.superAdminSettings.findFirst();
  const intervalMinutes = superSettings?.email_polling_interval_minutes ?? 5;

  const orgs = await prisma.organization.findMany({
    where: { is_active: true, intake_email_address: { not: null } },
    select: { id: true },
  });

  for (const org of orgs) {
    await emailIntakeQueue.add(
      "poll-inbox",
      { organizationId: org.id },
      {
        repeat: { every: intervalMinutes * 60 * 1000 },
        jobId: `poll-inbox:${org.id}`,
      },
    );
  }
}

scheduleEmailPolling().catch(console.error);

const workers = [reminderWorker, followUpWorker, reportWorker, emailIntakeWorker];

function shutdown() {
  console.log("Shutting down workers…");
  Promise.all(workers.map((w) => w.close()))
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("Workers started");
