/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json() as {
    title?: string;
    body?: string;
    data?: Record<string, string>;
    icon?: string;
  };
  const title = payload.title || "Dorada";
  const options: NotificationOptions = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as Record<string, string> | undefined;
  let url = "/";
  if (data?.type === "offer") {
    url = "/appointments?tab=offers";
  } else if (data?.type === "message") {
    url = "/messages";
  } else if (data?.type === "appointment_reminder" && data.appointment_id) {
    url = `/appointments/${data.appointment_id}`;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
