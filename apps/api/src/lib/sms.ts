import { config } from "../config.js";
import { logger } from "./logger.js";

function sinchConfigured() {
  return !!(
    config.SINCH_PROJECT_ID &&
    config.SINCH_KEY_ID &&
    config.SINCH_KEY_SECRET &&
    config.SINCH_APP_ID &&
    config.SINCH_FROM_NUMBER
  );
}

/**
 * Send an SMS via Sinch Conversation API.
 * Silently no-ops if Sinch credentials are not configured (dev without creds).
 */
export async function sendSms(to: string, body: string): Promise<void> {
  if (!sinchConfigured()) {
    if (config.NODE_ENV !== "production") {
      logger.warn(`[DEV SMS] to=${to}: ${body}`);
    }
    return;
  }

  console.log(`[SMS] sendSms called to=${to}`);
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

    const responseText = await resp.text().catch(() => "");
    if (!resp.ok) {
      logger.error({ status: resp.status, detail: responseText, to }, "Sinch SMS send failed");
    } else {
      logger.info({ status: resp.status, response: responseText, to }, "Sinch SMS sent");
    }
  } catch (err) {
    logger.error({ err, to }, "Sinch SMS send error");
  }
}
