import Fastify from "fastify";

import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { ZodError } from "zod";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import jwtPlugin from "./plugins/jwt.js";
import multipartPlugin from "./plugins/multipart.js";
import socketPlugin from "./plugins/socket.js";
import { registerRoutes } from "./routes/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const fastify = Fastify({
    logger,
    // Railway terminates TLS at its proxy — honor X-Forwarded-For so
    // request.ip (and per-IP rate limits) see the real client address.
    trustProxy: true,
    ajv: { customOptions: { strict: false } },
  });

  fastify.addHook("onRequest", (req, reply, done) => {
    const origin = req.headers.origin;
    if (origin) {
      reply.raw.setHeader("Access-Control-Allow-Origin", origin);
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
      reply.raw.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
      reply.raw.setHeader("Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] || "Content-Type,Authorization");
      reply.raw.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      reply.raw.writeHead(204);
      reply.raw.end();
      return;
    }
    done();
  });

  await fastify.register(fastifyHelmet, {
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  });
  await fastify.register(fastifyRateLimit, {
    max: 300,
    timeWindow: "1 minute",
    redis: undefined, // attached after redis plugin loads
  });

  await fastify.register(fastifyStatic, {
    root: join(__dirname, "..", "uploads"),
    prefix: "/uploads/",
    decorateReply: false,
  });

  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(multipartPlugin);
  await fastify.register(socketPlugin);


  fastify.get("/health", async (_request, reply) => {
    const checks: Record<string, "ok" | "down"> = { database: "ok", redis: "ok" };
    let healthy = true;
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = "down";
      healthy = false;
    }
    try {
      await fastify.redis.ping();
    } catch {
      checks.redis = "down";
      healthy = false;
    }
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      checks,
      uptime_seconds: Math.round(process.uptime()),
    });
  });

  await fastify.register(registerRoutes, { prefix: "/api/v1" });

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof ZodError) {
      const first = error.errors[0];
      const message = first ? `${first.path.join(".")}: ${first.message}` : error.message;
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message } });
    }
    logger.error({ err: error }, "unhandled error");
    return reply
      .status(500)
      .send({ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return fastify;
}
