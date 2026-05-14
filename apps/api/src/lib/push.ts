import { logger } from "./logger.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
  priority?: "high" | "normal";
  badge?: number;
}

export async function sendExpoPushNotifications(messages: PushMessage[]): Promise<void> {
  if (!messages.length) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo push notification request failed");
    }
  } catch (err) {
    logger.warn({ err }, "Expo push notification error");
  }
}
