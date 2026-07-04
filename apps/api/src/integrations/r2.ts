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

/**
 * Upload a buffer and return the OBJECT KEY (not a URL).
 * The bucket is private: store keys in the DB and resolve them to short-lived
 * signed URLs at read time via resolveFileUrl().
 */
export async function uploadBuffer(destination: string, buffer: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: config.R2_BUCKET,
    Key: destination,
    Body: buffer,
    ContentType: contentType,
  }));
  return destination;
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

export function noteImagePath(entityType: "appointment" | "clinic" | "agency" | "insurance_company" | "patient" | "interpreter", entityId: string, filename: string): string {
  return `dorada/notes/${entityType}/${entityId}/${filename}`;
}

export function messageImagePath(interpreterId: string, filename: string): string {
  return `dorada/messages/${interpreterId}/${filename}`;
}

export function appointmentMediaPath(appointmentId: string, filename: string): string {
  return `dorada/appointment-media/${appointmentId}/${filename}`;
}

export function avatarPath(kind: "user" | "interpreter", id: string, filename: string): string {
  return `avatars/${kind}/${id}/${filename}`;
}

// ─── Signed-URL file references ───────────────────────────────────────────────
//
// The DB stores R2 object KEYS. Legacy rows may hold permanent public URLs
// (`${R2_PUBLIC_URL}/<key>`), and clients echo signed URLs back on create —
// keyFromFileRef() recovers the key from any of those forms.

/** Avatars are cached client-side (auth store) — sign just under R2's 7-day cap. */
export const AVATAR_URL_TTL = 6 * 24 * 3600;

const R2_KEY_PREFIXES = ["dorada/", "avatars/"];

/** Extract the R2 object key from a stored/echoed file reference, or null if it isn't an R2 object. */
export function keyFromFileRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (R2_KEY_PREFIXES.some((p) => ref.startsWith(p))) return ref;
  if (config.R2_PUBLIC_URL && ref.startsWith(`${config.R2_PUBLIC_URL}/`)) {
    return ref.slice(config.R2_PUBLIC_URL.length + 1).split("?")[0]!;
  }
  try {
    const u = new URL(ref);
    if (u.hostname.endsWith(".r2.cloudflarestorage.com")) {
      const path = decodeURIComponent(u.pathname.replace(/^\//, ""));
      const bucketPrefix = `${config.R2_BUCKET}/`;
      return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : path;
    }
  } catch {
    // not a URL — fall through
  }
  return null;
}

/** Normalize a client-supplied file reference to a bare key before persisting. */
export function normalizeFileRef<T extends string | null | undefined>(ref: T): T | string {
  return keyFromFileRef(ref) ?? ref;
}

/**
 * Resolve a stored file reference to something a client can fetch:
 * R2 objects become short-lived signed URLs; anything else (local /uploads
 * paths in dev, data: URLs, external URLs) passes through unchanged.
 */
export async function resolveFileUrl(
  ref: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!ref) return null;
  const key = keyFromFileRef(ref);
  if (!key || !config.R2_ACCOUNT_ID) return ref;
  return getSignedUrl(key, expiresInSeconds);
}
