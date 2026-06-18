import { createHmac, timingSafeEqual } from "crypto";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createClinicConfirmationToken(orgId: string, clinicId: string, date: string, secret: string): string {
  const payload = `${orgId}:${clinicId}:${date}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(payload, secret)}`;
}

export function verifyClinicConfirmationToken(
  token: string,
  secret: string,
): { orgId: string; clinicId: string; date: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }

  const expected = sign(payload, secret);
  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [orgId, clinicId, date] = parts;
  return { orgId, clinicId, date };
}
