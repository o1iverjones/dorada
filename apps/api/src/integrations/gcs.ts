import { Storage } from "@google-cloud/storage";
import { config } from "../config.js";

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    storage = new Storage({ projectId: config.GCP_PROJECT_ID });
  }
  return storage;
}

export async function uploadBuffer(
  destination: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const bucket = getStorage().bucket(config.GCS_BUCKET);
  const file = bucket.file(destination);
  await file.save(buffer, { contentType, resumable: false, public: true });
  return `https://storage.googleapis.com/${config.GCS_BUCKET}/${destination}`;
}

export async function uploadString(
  destination: string,
  content: string,
  contentType = "text/plain",
): Promise<string> {
  return uploadBuffer(destination, Buffer.from(content, "utf-8"), contentType);
}

export async function getSignedUrl(
  gcsPath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const path = gcsPath.replace(`gs://${config.GCS_BUCKET}/`, "");
  const bucket = getStorage().bucket(config.GCS_BUCKET);
  const file = bucket.file(path);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return url;
}

export async function downloadAsBuffer(gcsPath: string): Promise<Buffer> {
  const path = gcsPath.replace(`gs://${config.GCS_BUCKET}/`, "");
  const bucket = getStorage().bucket(config.GCS_BUCKET);
  const [contents] = await bucket.file(path).download();
  return contents;
}

export function emailIntakePath(tenantId: string, emailId: string): string {
  return `dorada/email-intake/${tenantId}/${emailId}/raw.eml`;
}

export function followUpMediaPath(appointmentId: string, filename: string): string {
  return `dorada/follow-ups/${appointmentId}/${filename}`;
}

export function confirmationScreenshotPath(logId: string): string {
  return `dorada/email-confirmations/${logId}/screenshot.png`;
}

export function reportPath(reportJobId: string, format: "pdf" | "csv"): string {
  return `dorada/reports/${reportJobId}/report.${format}`;
}

export function noteImagePath(entityType: "appointment" | "clinic", entityId: string, filename: string): string {
  return `dorada/notes/${entityType}/${entityId}/${filename}`;
}

export function messageImagePath(interpreterId: string, filename: string): string {
  return `dorada/messages/${interpreterId}/${filename}`;
}
