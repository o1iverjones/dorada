import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { config, redisConnection } from "../config.js";
import { createAppointmentRemindersWorker } from "./appointment-reminders.worker.js";
import { createFollowUpFlowWorker } from "./follow-up-flow.worker.js";
import { createReportGenerationWorker } from "./report-generation.worker.js";
import { createEmailIntakeWorker } from "./email-intake.worker.js";
import { createAdminAlertWorker } from "./admin-alert.worker.js";

const prisma = new PrismaClient();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApp = any;

// Firebase — dynamically imported so the worker boots even if firebase-admin isn't installed
let fcmApp: AnyApp;
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error — firebase-admin is an optional dependency
  const admin = await import("firebase-admin");
  const adminDefault = admin.default ?? admin;
  if (!adminDefault.apps.length) {
    adminDefault.initializeApp({
      credential: adminDefault.credential.applicationDefault(),
      projectId: config.GCP_PROJECT_ID || undefined,
    });
  }
  fcmApp = adminDefault.app();
} catch {
  console.warn("⚠️  firebase-admin not available — push notifications disabled");
  fcmApp = { messaging: () => ({ send: async () => {} }) };
}

const reminderWorker = createAppointmentRemindersWorker(prisma, fcmApp);
const followUpWorker = createFollowUpFlowWorker(prisma, fcmApp);
const reportWorker = createReportGenerationWorker(prisma);
const emailIntakeWorker = createEmailIntakeWorker(prisma, fcmApp);
const adminAlertWorker = createAdminAlertWorker(prisma);

const emailIntakeQueue = new Queue("email-intake", { connection: redisConnection });

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

const workers = [reminderWorker, followUpWorker, reportWorker, emailIntakeWorker, adminAlertWorker];

function shutdown() {
  console.log("Shutting down workers…");
  Promise.all(workers.map((w) => w.close()))
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("✅ Workers started");
