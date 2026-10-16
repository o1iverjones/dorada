import webpush from "web-push";
import { config } from "../config.js";
import { logger } from "./logger.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    config.VAPID_SUBJECT || "mailto:noreply@dorada.app",
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY,
  );
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
}

export async function sendWebPushNotification(
  subscriptionJson: string,
  payload: WebPushPayload,
): Promise<boolean> {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
    logger.warn("VAPID keys not configured — skipping web push");
    return false;
  }
  try {
    const subscription = JSON.parse(subscriptionJson);
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      logger.info("Web push subscription expired or invalid");
      return false;
    }
    logger.warn({ err }, "Web push notification error");
    return false;
  }
}

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
