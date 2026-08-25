import { io, Socket } from "socket.io-client";

// Socket.io server is on the API, not the web app (which is a static SPA)
const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") ?? window.location.origin;

let instance: Socket | null = null;

export function getSocket(): Socket {
  if (!instance) {
    instance = io(API_ORIGIN, {
      // Read the token on EVERY (re)connect attempt. A static auth object
      // captures the token at page load; access tokens rotate every 15 min,
      // so after any disconnect (redeploy, laptop sleep, proxy idle) the
      // reconnect presented a stale token, failed auth, and the socket died
      // for the rest of the session — silently degrading messaging to the
      // 8s/30s polling fallbacks.
      auth: (cb) => cb({ token: `Bearer ${localStorage.getItem("dorada_access_token") ?? ""}` }),
      transports: ["websocket"],
      // Keep retrying with backoff (socket.io default) instead of giving up after 5 attempts.
    });
  }
  return instance;
}
