import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";

interface SocketUser {
  sub: string;
  type: "admin" | "interpreter";
  organization_id: string;
  name?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

export default fastifyPlugin(async function socketPlugin(fastify: FastifyInstance) {
  // fastify-socket.io types don't satisfy Fastify's register overloads; cast to bypass
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: fastifySocketIO } = await import("fastify-socket.io") as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (fastify.register as any)(fastifySocketIO, {
    cors: { origin: "*", credentials: true },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  fastify.io.use((socket: Socket, next) => {
    const token = (socket.handshake.auth as Record<string, string>)["token"];
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = fastify.jwt.verify<SocketUser>(token.replace(/^Bearer /, ""));
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  fastify.io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    const orgId = user.organization_id;

    // Interpreters auto-join their own conversation room on connect
    if (user.type === "interpreter") {
      socket.join(`conv:${orgId}:${user.sub}`);
    }
    // Admins auto-join an org-wide notifications room for unread badges
    if (user.type === "admin") {
      socket.join(`notify:${orgId}`);
    }

    socket.on("join_conversation", (data: { interpreter_id: string }) => {
      if (user.type !== "admin") return;
      socket.join(`conv:${orgId}:${data.interpreter_id}`);
    });

    socket.on("leave_conversation", (data: { interpreter_id: string }) => {
      if (user.type !== "admin") return;
      socket.leave(`conv:${orgId}:${data.interpreter_id}`);
    });

    socket.on("typing_start", (data: { interpreter_id?: string }) => {
      const interpreterId = user.type === "interpreter" ? user.sub : data.interpreter_id;
      if (!interpreterId) return;
      socket.to(`conv:${orgId}:${interpreterId}`).emit("typing", {
        sender_type: user.type,
        is_typing: true,
      });
    });

    socket.on("typing_stop", (data: { interpreter_id?: string }) => {
      const interpreterId = user.type === "interpreter" ? user.sub : data.interpreter_id;
      if (!interpreterId) return;
      socket.to(`conv:${orgId}:${interpreterId}`).emit("typing", {
        sender_type: user.type,
        is_typing: false,
      });
    });
  });
});
