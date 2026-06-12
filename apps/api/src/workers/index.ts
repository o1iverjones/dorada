import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { redisConnection } from "../config.js";
import { createAppointmentRemindersWorker } from "./appointment-reminders.worker.js";
import { createFollowUpFlowWorker } from "./follow-up-flow.worker.js";
import { createReportGenerationWorker } from "./report-generation.worker.js";
import { createEmailIntakeWorker } from "./email-intake.worker.js";
import { createAdminAlertWorker } from "./admin-alert.worker.js";
import { createClinicConfirmationWorker, scheduleClinicConfirmationPolling } from "./clinic-confirmation.worker.js";

const prisma = new PrismaClient();

const reminderWorker = createAppointmentRemindersWorker(prisma);
const followUpWorker = createFollowUpFlowWorker(prisma);
const reportWorker = createReportGenerationWorker(prisma);
const emailIntakeWorker = createEmailIntakeWorker(prisma);
const adminAlertWorker = createAdminAlertWorker(prisma);
const clinicConfirmationWorker = createClinicConfirmationWorker(prisma);

const emailIntakeQueue = new Queue("email-intake", { connection: redisConnection });

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
scheduleClinicConfirmationPolling().catch(console.error);

const workers = [reminderWorker, followUpWorker, reportWorker, emailIntakeWorker, adminAlertWorker, clinicConfirmationWorker];

function shutdown() {
  console.log("Shutting down workers…");
  Promise.all(workers.map((w) => w.close()))
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("✅ Workers started");
