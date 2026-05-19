import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  CORS_ORIGIN: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  ADMIN_REFRESH_TTL_HOURS: z.coerce.number().default(8),
  MFA_TOKEN_TTL: z.string().default("5m"),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional().or(z.literal("")),
  SENDGRID_FROM_NAME: z.string().default("Dorada"),

  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  GCS_BUCKET: z.string().default("dorada-media"),
  GCP_PROJECT_ID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-6"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    process.stdout.write(`[config] FATAL - missing or invalid env vars:\n${JSON.stringify(result.error.format(), null, 2)}\n`);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();

/** Parsed Redis connection options derived from REDIS_URL, for use with BullMQ. */
function parseRedisConnection() {
  try {
    const url = new URL(config.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      username: url.username && url.username !== "default" ? url.username : undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return { host: config.REDIS_HOST, port: config.REDIS_PORT };
  }
}

export const redisConnection = parseRedisConnection();
