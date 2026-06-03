import { config } from "../config.js";
import { logger } from "./logger.js";

// Lazily initialised so the server boots even when Twilio credentials aren't set.
let _client: { messages: { create: (opts: { to: string; from: string; body: string }) => Promise<unknown> } } | null = null;

async function getClient() {
  if (_client) return _client;

  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_FROM_NUMBER) {
    logger.warn("Twilio credentials not configured — SMS sending is disabled");
    return null;
  }

  const { default: twilio } = await import("twilio");
  _client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  return _client;
}

/**
 * Send an SMS via Twilio.
 * Silently no-ops if Twilio credentials are not configured (dev / staging without creds).
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const client = await getClient();
  if (!client) {
    // Log the message in dev so OTPs are still accessible without Twilio
    if (config.NODE_ENV !== "production") {
      logger.warn(`[DEV SMS] to=${to}: ${body}`);
    }
    return;
  }

  try {
    await client.messages.create({
      to,
      from: config.TWILIO_FROM_NUMBER!,
      body,
    });
  } catch (err) {
    // Log but don't throw — a failed SMS shouldn't crash the request
    logger.error({ err, to }, "Twilio SMS send failed");
  }
}
