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

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/interpreter/otp/request
  fastify.post("/interpreter/otp/request", async (request, reply) => {
    const body = RequestOtpBodySchema.parse(request.body);
    await requestOtp(body.phone, fastify.prisma, fastify.redis);
    return reply.send({ message: "OTP sent if number is registered." });
  });

  // POST /auth/interpreter/otp/verify
  fastify.post("/interpreter/otp/verify", async (request, reply) => {
    const body = VerifyOtpBodySchema.parse(request.body);
    const result = await verifyOtp(body.phone, body.otp, fastify.prisma, fastify.redis, fastify);
    return reply.send(result);
  });

  // POST /auth/admin/login
  fastify.post("/admin/login", async (request, reply) => {
    const body = AdminLoginBodySchema.parse(request.body);
    const result = await adminLogin(body.email, body.password, fastify.prisma, fastify.redis, fastify);
    return reply.send(result);
  });

  // POST /auth/admin/mfa/verify
  fastify.post("/admin/mfa/verify", async (request, reply) => {
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

  // POST /auth/admin/password/reset-request
  fastify.post("/admin/password/reset-request", async (request, reply) => {
    const body = PasswordResetRequestBodySchema.parse(request.body);
    await requestPasswordReset(body.email, fastify.prisma, fastify.redis);
    return reply.send({ message: "Reset link sent if email is registered." });
  });

  // POST /auth/admin/password/reset-confirm
  fastify.post("/admin/password/reset-confirm", async (request, reply) => {
    const body = PasswordResetConfirmBodySchema.parse(request.body);
    await confirmPasswordReset(body.reset_token, body.new_password, fastify.prisma, fastify.redis);
    return reply.send({ message: "Password updated successfully." });
  });
}
