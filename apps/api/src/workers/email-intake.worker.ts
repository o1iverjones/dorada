import { Worker, Queue, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import Imap from "imap";
import { simpleParser } from "mailparser";
import { config, redisConnection } from "../config.js";
import { sendEmail } from "../lib/email.js";
import { sendExpoPushNotifications } from "../lib/push.js";
import { extractAppointmentFromEmail } from "../integrations/claude.js";
import {
  uploadString,
  uploadBuffer,
  emailIntakePath,
  confirmationScreenshotPath,
} from "../integrations/r2.js";
import { confirmViaLink } from "../integrations/playwright.js";

interface EmailPollJobData {
  organizationId: string;
}

interface EmailProcessJobData {
  organizationId: string;
  emailLogId: string;
}

interface ConfirmationRetryJobData {
  logId: string;
  organizationId: string;
}

const emailIntakeQueue = new Queue("email-intake", {
  connection: redisConnection,
});

export function createEmailIntakeWorker(
  prisma: PrismaClient,
) {
  return new Worker<EmailPollJobData | EmailProcessJobData | ConfirmationRetryJobData>(
    "email-intake",
    async (job: Job) => {
      if (job.name === "poll-inbox") {
        await handlePollInbox(job as Job<EmailPollJobData>, prisma);
      } else if (job.name === "process-email") {
        await handleProcessEmail(job as Job<EmailProcessJobData>, prisma);
      } else if (job.name === "retry-confirmation") {
        await handleRetryConfirmation(job as Job<ConfirmationRetryJobData>, prisma);
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );
}

async function handlePollInbox(job: Job<EmailPollJobData>, prisma: PrismaClient) {
  const { organizationId } = job.data;

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org?.intake_email_address) return;

  const superSettings = await prisma.superAdminSettings.findFirst();
  if (!superSettings?.imap_host) return;

  const emails = await fetchUnseenEmails(superSettings.imap_host, superSettings.imap_user!, superSettings.imap_password!);

  for (const email of emails) {
    const existingLog = await prisma.emailIntakeLog.findFirst({
      where: { organization_id: organizationId, message_id: email.messageId ?? "" },
    });
    if (existingLog) continue;

    const gcsPath = emailIntakePath(organizationId, email.messageId ?? crypto.randomUUID());
    await uploadString(gcsPath, email.rawText ?? "", "text/plain");

    await prisma.emailIntakeLog.create({
      data: {
        organization_id: organizationId,
        message_id: email.messageId ?? "",
        from_email: email.from ?? "",
        subject: email.subject ?? "",
        raw_email_gcs_path: gcsPath,
        status: "unprocessed",
        received_at: email.date ?? new Date(),
      },
    });

    await emailIntakeQueue.add(
      "process-email",
      { organizationId, emailLogId: "" } as EmailProcessJobData,
    );
  }
}

async function handleProcessEmail(
  job: Job<EmailProcessJobData>,
  prisma: PrismaClient,
) {
  const { emailLogId, organizationId } = job.data;

  const log = await prisma.emailIntakeLog.findUnique({
    where: { id: emailLogId },
    include: { agency: true },
  });
  if (!log) return;
  if (log.status !== "unprocessed") return;

  await prisma.emailIntakeLog.update({ where: { id: emailLogId }, data: { status: "processing" } });

  const superSettings = await prisma.superAdminSettings.findFirst();
  const modelOverride = superSettings?.claude_model ?? undefined;

  let extraction;
  try {
    extraction = await extractAppointmentFromEmail(log.subject + "\n" + log.body_text, modelOverride);
  } catch (err) {
    await prisma.emailIntakeLog.update({
      where: { id: emailLogId },
      data: { status: "failed", error_detail: String(err) },
    });
    return;
  }

  await prisma.emailIntakeExtraction.create({
    data: {
      log_id: emailLogId,
      extracted_fields: extraction as object,
      confidence_scores: {},
      unresolved_fields: extraction.unresolved_fields,
      model_used: modelOverride ?? config.CLAUDE_MODEL,
      prompt_version: "v1",
    },
  });

  // Duplicate PO check
  if (extraction.po_number) {
    const existingAppt = await prisma.appointment.findFirst({
      where: { organization_id: organizationId, po_number: extraction.po_number },
    });
    if (existingAppt) {
      await prisma.emailIntakeLog.update({
        where: { id: emailLogId },
        data: { status: "flagged", duplicate_po: true },
      });
      await notifyAdmins(organizationId, "duplicate_po", emailLogId, prisma);
      return;
    }
  }

  const hasUnresolved = extraction.unresolved_fields.includes("po_number") ||
    extraction.unresolved_fields.includes("date_time");

  const draft = await prisma.emailIntakeDraft.create({
    data: {
      log_id: emailLogId,
      status: "pending_review",
      po_number: extraction.po_number ?? null,
      extracted_patient_name: extraction.patient_name ?? null,
      extracted_clinic_name: extraction.clinic_name ?? null,
      extracted_doctor_name: extraction.doctor_name ?? null,
      extracted_date_time: extraction.date_time ?? null,
      extracted_languages: extraction.languages,
      has_unresolved_fields: hasUnresolved || extraction.unresolved_fields.length > 0,
      unresolved_fields: extraction.unresolved_fields,
    },
  });

  const confirmationMethod = log.agency?.email_intake_confirmation_override ??
    extraction.confirmation_method ?? "reply_email";

  await prisma.emailIntakeLog.update({
    where: { id: emailLogId },
    data: {
      status: "processed",
      processed_at: new Date(),
      confirmation_method: confirmationMethod,
      has_unresolved_fields: hasUnresolved,
    },
  });

  if (!hasUnresolved) {
    await performConfirmation(log, draft.id, confirmationMethod, extraction.confirmation_link_url ?? null, prisma);
  }

  await notifyAdmins(organizationId, "new_email_draft", emailLogId, prisma);
}

async function handleRetryConfirmation(
  job: Job<ConfirmationRetryJobData>,
  prisma: PrismaClient,
) {
  const { logId, organizationId } = job.data;
  const log = await prisma.emailIntakeLog.findUnique({
    where: { id: logId },
    include: { draft: true, agency: true },
  });
  if (!log || log.organization_id !== organizationId || !log.draft) return;

  const method = log.confirmation_method ?? "reply_email";
  await performConfirmation(log, log.draft.id, method, null, prisma);
}

async function performConfirmation(
  log: { id: string; from_email: string; agency: { email_intake_reply_template?: string | null; email_intake_reply_from_email?: string | null } | null },
  _draftId: string,
  method: string,
  linkUrl: string | null,
  prisma: PrismaClient,
) {
  if (method === "reply_email") {
    try {
      const template = log.agency?.email_intake_reply_template ?? "Your appointment has been accepted.";
      await sendEmail({
        to: log.from_email,
        subject: "Appointment Confirmation",
        html: `<p>${template}</p>`,
        text: template,
      });
      await prisma.emailIntakeLog.update({
        where: { id: log.id },
        data: { confirmation_status: "success", confirmation_executed_at: new Date() },
      });
    } catch (err) {
      await prisma.emailIntakeLog.update({
        where: { id: log.id },
        data: { confirmation_status: "failed", confirmation_error: String(err), confirmation_executed_at: new Date() },
      });
    }
    return;
  }

  if (method === "confirmation_link" && linkUrl) {
    const result = await confirmViaLink(linkUrl);
    let screenshotGcsPath: string | null = null;

    if (result.screenshot) {
      screenshotGcsPath = confirmationScreenshotPath(log.id);
      await uploadBuffer(screenshotGcsPath, result.screenshot, "image/png");
    }

    await prisma.emailIntakeLog.update({
      where: { id: log.id },
      data: {
        confirmation_status: result.success ? "success" : "failed",
        confirmation_error: result.error,
        confirmation_screenshot_gcs_path: screenshotGcsPath,
        confirmation_executed_at: new Date(),
      },
    });
  }
}

async function notifyAdmins(
  organizationId: string,
  eventType: string,
  relatedId: string,
  prisma: PrismaClient,
) {
  const users = await prisma.user.findMany({
    where: { organization_id: organizationId, is_active: true },
    include: { preferences: true },
  });

  for (const user of users) {
    const pref = user.preferences?.email_intake_notification ?? "queue_only";
    if (pref === "immediate_push" && user.fcm_token) {
      await sendExpoPushNotifications([{
        to: user.fcm_token,
        title: "New Email Intake Draft",
        body: "An email requires your review.",
        data: { type: eventType, related_id: relatedId },
        sound: "default",
      }]);
    } else if (pref === "immediate_email" && user.email) {
      await sendEmail({
        to: user.email,
        subject: "New appointment draft from email intake",
        html: `<p>A new draft appointment has been created and requires review. Log ID: ${relatedId}</p>`,
        text: `A new draft appointment has been created and requires review. Log ID: ${relatedId}`,
      }).catch(() => {});
    }
  }
}

async function fetchUnseenEmails(
  host: string,
  user: string,
  password: string,
): Promise<Array<{ messageId?: string; from?: string; subject?: string; date?: Date; rawText?: string; body_text?: string }>> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({ host, user, password, port: 993, tls: true, tlsOptions: { rejectUnauthorized: false } });
    const emails: Array<{ messageId?: string; from?: string; subject?: string; date?: Date; rawText?: string }> = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) return reject(err);
        imap.search(["UNSEEN"], (searchErr, uids) => {
          if (searchErr) return reject(searchErr);
          if (!uids || uids.length === 0) { imap.end(); return; }

          const fetch = imap.fetch(uids, { bodies: "", markSeen: true });
          fetch.on("message", (msg) => {
            const chunks: Buffer[] = [];
            msg.on("body", (stream) => {
              stream.on("data", (chunk: Buffer) => chunks.push(chunk));
              stream.once("end", async () => {
                const raw = Buffer.concat(chunks).toString("utf-8");
                const parsed = await simpleParser(raw);
                emails.push({
                  messageId: parsed.messageId ?? undefined,
                  from: parsed.from?.text,
                  subject: parsed.subject,
                  date: parsed.date ?? undefined,
                  rawText: raw,
                });
              });
            });
          });
          fetch.once("end", () => imap.end());
          fetch.once("error", reject);
        });
      });
    });

    imap.once("end", () => resolve(emails));
    imap.once("error", reject);
    imap.connect();
  });
}
