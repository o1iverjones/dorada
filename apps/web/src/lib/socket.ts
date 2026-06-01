import { io, Socket } from "socket.io-client";

// Socket.io server is on the API, not the web app (which is a static SPA)
const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") ?? window.location.origin;

let instance: Socket | null = null;

export function getSocket(): Socket {
  if (!instance) {
    const token = localStorage.getItem("dorada_access_token") ?? "";
    instance = io(API_ORIGIN, {
      auth: { token: `Bearer ${token}` },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });
  }
  return instance;
}
