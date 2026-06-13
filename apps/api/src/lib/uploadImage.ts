import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { extname } from "path";
import type { MultipartFile } from "@fastify/multipart";
import { uploadBuffer } from "../integrations/gcs.js";
import { config } from "../config.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/heic", "image/webp", "image/gif"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export class ImageUploadError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function extForMime(mime: string, originalFilename: string): string {
  const fromFile = extname(originalFilename || "");
  if (fromFile) return fromFile;
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/gif": ".gif",
  };
  return map[mime] ?? ".jpg";
}

/** Upload a multipart image file. Returns the public URL. */
export async function uploadImage(data: MultipartFile, gcsDestination: string): Promise<string> {
  if (!ALLOWED_MIME.has(data.mimetype)) {
    throw new ImageUploadError("INVALID_FILE_TYPE", "Only JPEG, PNG, HEIC, WebP, and GIF images are accepted");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  if (buffer.length > MAX_BYTES) {
    throw new ImageUploadError("FILE_TOO_LARGE", "File exceeds the 10 MB limit");
  }

  if (config.NODE_ENV === "production") {
    const gcsPath = await uploadBuffer(gcsDestination, buffer, data.mimetype);
    // Return a path-based URL; callers can sign it if needed, but for inline display
    // we return the public GCS path. For signed URLs add getSignedUrl() here.
    return gcsPath;
  }

  // Local dev: save to uploads/images/
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const uploadsDir = join(__dirname, "..", "..", "..", "uploads", "images");
  await mkdir(uploadsDir, { recursive: true });
  const ext = extForMime(data.mimetype, data.filename || "");
  const filename = `${randomUUID()}${ext}`;
  await writeFile(join(uploadsDir, filename), buffer);
  return `/uploads/images/${filename}`;
}

export function imageFilename(originalFilename: string, mime: string): string {
  return `${randomUUID()}${extForMime(mime, originalFilename)}`;
}
