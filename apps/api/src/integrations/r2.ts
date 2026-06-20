import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { config } from "../config.js";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID!,
        secretAccessKey: config.R2_SECRET_ACCESS_ID!,
      },
    });
  }
  return client;
}

export async function uploadBuffer(destination: string, buffer: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: config.R2_BUCKET,
    Key: destination,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${config.R2_PUBLIC_URL}/${destination}`;
}

export async function uploadString(destination: string, content: string, contentType = "text/plain"): Promise<string> {
  return uploadBuffer(destination, Buffer.from(content, "utf-8"), contentType);
}

export async function getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: key });
  return s3GetSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function downloadAsBuffer(key: string): Promise<Buffer> {
  const response = await getClient().send(new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: key }));
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
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

export function noteImagePath(entityType: "appointment" | "clinic" | "agency", entityId: string, filename: string): string {
  return `dorada/notes/${entityType}/${entityId}/${filename}`;
}

export function messageImagePath(interpreterId: string, filename: string): string {
  return `dorada/messages/${interpreterId}/${filename}`;
}
