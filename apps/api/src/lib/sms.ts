import { config } from "../config.js";
import { logger } from "./logger.js";

export function sinchConfigured() {
  return !!(
    config.SINCH_PROJECT_ID &&
    config.SINCH_KEY_ID &&
    config.SINCH_KEY_SECRET &&
    config.SINCH_APP_ID &&
    config.SINCH_FROM_NUMBER
  );
}

export interface SmsResult {
  /** false when Sinch env vars are missing (dev no-op). */
  configured: boolean;
  /** true when Sinch accepted the message (2xx). */
  ok: boolean;
  /** HTTP status from Sinch, or 0 on a transport error. */
  status: number;
  /** Sinch response body (or error message) — the actual diagnostic. */
  detail: string;
}

/**
 * Low-level Sinch Conversation API send. Returns the raw outcome so callers
 * (and the dev diagnostic endpoint) can see exactly what Sinch said. Never
 * throws — transport errors come back as { ok:false, status:0 }.
 */
export async function sendSmsRaw(to: string, body: string): Promise<SmsResult> {
  if (!sinchConfigured()) {
    return { configured: false, ok: false, status: 0, detail: "Sinch not configured" };
  }

  const region = config.SINCH_REGION.toUpperCase();
  const url = `https://${region}.conversation.api.sinch.com/v1/projects/${config.SINCH_PROJECT_ID}/messages:send`;
  const credentials = Buffer.from(`${config.SINCH_KEY_ID}:${config.SINCH_KEY_SECRET}`).toString("base64");

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({
        app_id: config.SINCH_APP_ID,
        recipient: {
          identified_by: {
            channel_identities: [{ channel: "SMS", identity: to }],
          },
        },
        message: {
          text_message: { text: body },
        },
        channel_properties: {
          SMS_SENDER: config.SINCH_FROM_NUMBER,
        },
      }),
    });
    const detail = await resp.text().catch(() => "");
    return { configured: true, ok: resp.ok, status: resp.status, detail };
  } catch (err) {
    return { configured: true, ok: false, status: 0, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send an SMS via Sinch. Fire-and-forget: logs the outcome, never throws — a
 * failed SMS must not break the request that triggered it. Silently no-ops if
 * Sinch is not configured (dev), logging the message so OTPs stay testable.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const result = await sendSmsRaw(to, body);
  if (!result.configured) {
    if (config.NODE_ENV !== "production") logger.warn(`[DEV SMS] to=${to}: ${body}`);
    return;
  }
  if (result.ok) {
    logger.info({ status: result.status, to }, "Sinch SMS sent");
  } else {
    logger.error({ status: result.status, detail: result.detail, to }, "Sinch SMS send failed");
  }
}
