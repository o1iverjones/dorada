import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
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

  await fastify.register(fastifyHelmet);
  if (!config.CORS_ORIGIN) {
    // Railway builds run with NODE_ENV=production in BOTH environments, and
    // each env serves the web app from a different origin — so there is no
    // safe origin to guess here. Defaulting to a fixed list once took down
    // the dev environment entirely (login + every XHR blocked). Reflect all
    // origins but complain loudly: set CORS_ORIGIN on every deployment.
    logger.warn("CORS_ORIGIN is not set — reflecting ALL origins. Set CORS_ORIGIN explicitly on this environment.");
  }
  await fastify.register(fastifyCors, {
    origin: config.CORS_ORIGIN ? config.CORS_ORIGIN.split(",").map((o) => o.trim()) : true,
    credentials: true,
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

  // Liveness/readiness probe — used by Railway health checks and for quick
  // production triage. Raw queries bypass the tenant guard (model ops only).
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
