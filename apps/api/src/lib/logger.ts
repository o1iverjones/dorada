import pino from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  // Never write credentials to logs (Fastify logs req/res objects on errors).
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.password_hash",
      "*.refresh_token",
      "*.access_token",
    ],
    censor: "[redacted]",
  },
  ...(config.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
