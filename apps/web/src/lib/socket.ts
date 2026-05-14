import { io, Socket } from "socket.io-client";

let instance: Socket | null = null;

export function getSocket(): Socket {
  if (!instance) {
    const token = localStorage.getItem("pulpito_access_token") ?? "";
    instance = io(window.location.origin, {
      auth: { token: `Bearer ${token}` },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });
  }
  return instance;
}
