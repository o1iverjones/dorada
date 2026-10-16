import type { FastifyInstance } from "fastify";
import {
  RequestOtpBodySchema,
  VerifyOtpBodySchema,
  AdminLoginBodySchema,
  AdminMfaVerifyBodySchema,
  AdminMfaConfirmBodySchema,
  RefreshTokenBodySchema,
  PasswordResetRequestBodySchema,
  PasswordResetConfirmBodySchema,
} from "@dorada/types";
import {
  requestOtp,
  verifyOtp,
  adminLogin,
  adminMfaVerify,
  setupMfa,
  confirmMfa,
  refreshTokens,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
} from "./auth.service.js";
import { authenticate } from "../../middleware/auth.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { config } from "../../config.js";
import { z } from "zod";

/** Stricter per-IP throttles for credential endpoints (global default is 300/min). */
const throttle = (max: number, timeWindow: string) => ({ config: { rateLimit: { max, timeWindow } } });

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/interpreter/otp/request
  fastify.post("/interpreter/otp/request", throttle(5, "1 minute"), async (request, reply) => {
    const body = RequestOtpBodySchema.parse(request.body);
    await requestOtp(body.email, fastify.prisma, fastify.redis);
    return reply.send({ message: "OTP sent if email is registered." });
  });

  // POST /auth/interpreter/otp/verify
  fastify.post("/interpreter/otp/verify", throttle(15, "1 minute"), async (request, reply) => {
    const body = VerifyOtpBodySchema.parse(request.body);
    const result = await verifyOtp(body.email, body.otp, fastify.prisma, fastify.redis, fastify);
    return reply.send(result);
  });

  // POST /auth/admin/login
  fastify.post("/admin/login", throttle(10, "1 minute"), async (request, reply) => {
    const body = AdminLoginBodySchema.parse(request.body);
    const result = await adminLogin(body.email, body.password, fastify.prisma, fastify.redis, fastify);
    return reply.send(result);
  });

  // POST /auth/admin/mfa/verify
  fastify.post("/admin/mfa/verify", throttle(15, "1 minute"), async (request, reply) => {
    const body = AdminMfaVerifyBodySchema.parse(request.body);
    const result = await adminMfaVerify(body.mfa_token, body.totp_code, fastify.prisma, fastify);
    return reply.send(result);
  });

  // POST /auth/admin/mfa/setup  (requires admin JWT — used during onboarding)
  fastify.post("/admin/mfa/setup", { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const user = await fastify.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });
    if (!user) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    const result = await setupMfa(user.id, user.email, user.organization.name, fastify.redis);
    return reply.send(result);
  });

  // POST /auth/admin/mfa/confirm
  fastify.post("/admin/mfa/confirm", { preHandler: authenticate }, async (request, reply) => {
    const body = AdminMfaConfirmBodySchema.parse(request.body);
    const payload = request.user as JwtPayload;
    await confirmMfa(payload.sub, body.totp_code, fastify.prisma, fastify.redis);
    return reply.send({ mfa_enabled: true });
  });

  // POST /auth/refresh
  fastify.post("/refresh", async (request, reply) => {
    const body = RefreshTokenBodySchema.parse(request.body);
    const result = await refreshTokens(body.refresh_token, fastify.prisma, fastify);
    return reply.send(result);
  });

  // POST /auth/logout
  fastify.post("/logout", { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    await logout(payload.sub, payload.type === "interpreter", fastify.prisma);
    return reply.status(204).send();
  });

  fastify.get("/vapid-public-key", async (_request, reply) => {
    if (!config.VAPID_PUBLIC_KEY) {
      return reply.status(404).send({ error: { message: "Web push not configured" } });
    }
    return reply.send({ publicKey: config.VAPID_PUBLIC_KEY });
  });

  // DEV-ONLY backdoors (OTP retrieval, SMS test, rate-limit reset, job
  // triggers). These are UNAUTHENTICATED and dangerous in production, so gate
  // on an explicit APP_ENV === "dev" — never a "not production" check that a
  // stray env value ("staging", etc.) could slip through.
  if (config.APP_ENV === "dev") {
    // POST /auth/dev/trigger-stale-billing — immediately enqueues a stale-billing-check job
    fastify.post("/dev/trigger-stale-billing", async (_request, reply) => {
      const { adminAlertQueue } = await import("../../workers/admin-alert.worker.js");
      await adminAlertQueue.add("stale-billing-check", {});
      return reply.send({ triggered: true });
    });

    // POST /auth/dev/trigger-clinic-confirmations — bypasses time window and sends immediately
    fastify.post("/dev/trigger-clinic-confirmations", async (_request, reply) => {
      const { forceSendClinicConfirmations } = await import("../../workers/clinic-confirmation.worker.js");
      await forceSendClinicConfirmations(fastify.prisma);
      return reply.send({ triggered: true, note: "confirmation emails sent directly (time window bypassed)" });
    });
    // GET /auth/dev/otp/:email — retrieve the pending OTP for an interpreter email
    fastify.get("/dev/otp/:email", async (request, reply) => {
      const { email } = request.params as { email: string };
      const normalizedEmail = email.toLowerCase().trim();
      const interpreter = await fastify.prisma.interpreter.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, is_active: true },
      });
      if (!interpreter) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No interpreter found for this email" } });
      const otp = await fastify.redis.get(`otp:${normalizedEmail}`);
      if (!otp) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No pending OTP — request one first" } });
      return reply.send({ otp });
    });

    // DELETE /auth/dev/reset/:email — clears rate limit + OTP so you can retry immediately
    fastify.delete("/dev/reset/:email", async (request, reply) => {
      const { email } = request.params as { email: string };
      const normalizedEmail = email.toLowerCase().trim();
      await fastify.redis.del(
        `otp:rate:${normalizedEmail}`,
        `otp:${normalizedEmail}`,
        `otp:lock:${normalizedEmail}`,
        `otp:attempts:${normalizedEmail}`,
      );
      return reply.send({ cleared: true });
    });
  }

  // POST /auth/admin/password/reset-request — sends email; throttle hard to
  // prevent outbound-email abuse and account probing.
  fastify.post("/admin/password/reset-request", throttle(5, "15 minutes"), async (request, reply) => {
    const body = PasswordResetRequestBodySchema.parse(request.body);
    await requestPasswordReset(body.email, fastify.prisma, fastify.redis);
    return reply.send({ message: "Reset link sent if email is registered." });
  });

  // POST /auth/admin/password/reset-confirm
  fastify.post("/admin/password/reset-confirm", throttle(10, "1 minute"), async (request, reply) => {
    const body = PasswordResetConfirmBodySchema.parse(request.body);
    await confirmPasswordReset(body.reset_token, body.new_password, fastify.prisma, fastify.redis);
    return reply.send({ message: "Password updated successfully." });
  });
}
