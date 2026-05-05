import { randomInt } from "crypto";
import bcrypt from 'bcryptjs';
import { authenticator } from "otplib";
import QRCode from "qrcode";
import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import {
  UnauthorizedError,
  ConflictError,
  TooManyRequestsError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import { config } from "../../config.js";

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_RATE_LIMIT_WINDOW = 600;
const OTP_RATE_LIMIT_MAX = 3;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_SECONDS = 900; // 15 minutes
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCK_SECONDS = 900;
const BCRYPT_ROUNDS = 12;

// ─── OTP (Interpreter) ────────────────────────────────────────────────────────

export async function requestOtp(
  phone: string,
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const rateLimitKey = `otp:rate:${phone}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) await redis.expire(rateLimitKey, OTP_RATE_LIMIT_WINDOW);
  if (count > OTP_RATE_LIMIT_MAX) {
    throw new TooManyRequestsError("OTP_RATE_LIMITED", "Too many OTP requests");
  }

  const interpreter = await prisma.interpreter.findFirst({ where: { phone, is_active: true } });
  if (!interpreter) return; // silent — prevents enumeration

  const otp = String(randomInt(100000, 999999));
  const otpKey = `otp:${phone}`;
  await redis.set(otpKey, otp, "EX", OTP_TTL_SECONDS);

  // In production, send via Twilio. Here we log in dev.
  if (config.NODE_ENV === "development") {
    console.warn(`[DEV] OTP for ${phone}: ${otp}`);
  }
  // TODO: twilio.messages.create({ to: phone, from: config.TWILIO_FROM_NUMBER, body: `Your Pulpito code: ${otp}` })
}

export async function verifyOtp(
  phone: string,
  otp: string,
  prisma: PrismaClient,
  redis: Redis,
  fastify: FastifyInstance,
): Promise<{ access_token: string; refresh_token: string; interpreter: { id: string; name: string; phone: string } }> {
  const lockKey = `otp:lock:${phone}`;
  const attemptsKey = `otp:attempts:${phone}`;

  const locked = await redis.get(lockKey);
  if (locked) throw new TooManyRequestsError("ACCOUNT_LOCKED", "Account locked. Try again later.");

  const interpreter = await prisma.interpreter.findFirst({
    where: { phone, is_active: true },
  });
  if (!interpreter) throw new UnauthorizedError("INVALID_CREDENTIALS", "Invalid OTP");

  const storedOtp = await redis.get(`otp:${phone}`);
  if (!storedOtp || storedOtp !== otp) {
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, OTP_LOCK_SECONDS);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await redis.set(lockKey, "1", "EX", OTP_LOCK_SECONDS);
      await redis.del(attemptsKey);
    }
    throw new UnauthorizedError("INVALID_CREDENTIALS", "Invalid OTP");
  }

  await redis.del(`otp:${phone}`, attemptsKey);

  const accessToken = fastify.jwt.sign(
    { sub: interpreter.id, type: "interpreter", organization_id: interpreter.organization_id },
    { expiresIn: config.JWT_ACCESS_TTL },
  );

  const refreshToken = fastify.jwt.sign(
    { sub: interpreter.id, type: "interpreter_refresh" },
    { expiresIn: `${config.JWT_REFRESH_TTL_DAYS}d` },
  );

  const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL_DAYS * 86400_000);
  await prisma.refreshToken.create({
    data: { interpreter_id: interpreter.id, token_hash: tokenHash, expires_at: expiresAt },
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    interpreter: { id: interpreter.id, name: interpreter.name, phone: interpreter.phone },
  };
}

// ─── Admin Auth ───────────────────────────────────────────────────────────────

export async function adminLogin(
  email: string,
  password: string,
  prisma: PrismaClient,
  redis: Redis,
  fastify: FastifyInstance,
): Promise<{ mfa_token: string } | { access_token: string; refresh_token: string; admin: object }> {
  const attemptsKey = `admin:attempts:${email}`;
  const lockKey = `admin:lock:${email}`;

  const locked = await redis.get(lockKey);
  if (locked) throw new TooManyRequestsError("ACCOUNT_LOCKED", "Account locked. Try again later.");

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, is_active: true },
    include: { role: { include: { permissions: true } } },
  });

  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !validPassword) {
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, ADMIN_LOCK_SECONDS);
    if (attempts >= ADMIN_MAX_ATTEMPTS) {
      await redis.set(lockKey, "1", "EX", ADMIN_LOCK_SECONDS);
      await redis.del(attemptsKey);
    }
    throw new UnauthorizedError("INVALID_CREDENTIALS", "Invalid credentials");
  }

  await redis.del(attemptsKey);

  // MFA not enabled — issue tokens directly
  if (!user.mfa_enabled) {
    const permissions = user.role.permissions.map((p) => p.permission);
    const accessToken = fastify.jwt.sign(
      { sub: user.id, type: "admin", organization_id: user.organization_id, role_id: user.role_id, permissions },
      { expiresIn: config.JWT_ACCESS_TTL },
    );
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, type: "admin_refresh" },
      { expiresIn: `${config.ADMIN_REFRESH_TTL_HOURS}h` },
    );
    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + config.ADMIN_REFRESH_TTL_HOURS * 3600_000);
    await prisma.refreshToken.create({ data: { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt } });
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      admin: { id: user.id, name: user.name, email: user.email, role: { id: user.role.id, name: user.role.name }, permissions },
    };
  }

  const mfaToken = fastify.jwt.sign(
    { sub: user.id, type: "mfa_pending", organization_id: user.organization_id },
    { expiresIn: config.MFA_TOKEN_TTL },
  );

  return { mfa_token: mfaToken };
}

export async function adminMfaVerify(
  mfaToken: string,
  totpCode: string,
  prisma: PrismaClient,
  fastify: FastifyInstance,
): Promise<{ access_token: string; refresh_token: string; admin: object }> {
  let payload: { sub: string; type: string; organization_id: string };
  try {
    payload = fastify.jwt.verify<{ sub: string; type: string; organization_id: string }>(mfaToken);
  } catch {
    throw new UnauthorizedError("MFA_TOKEN_INVALID", "Invalid or expired MFA token");
  }

  if (payload.type !== "mfa_pending") {
    throw new UnauthorizedError("MFA_TOKEN_INVALID", "Invalid MFA token type");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: true } } },
  });

  if (!user || !user.mfa_enabled || !user.totp_secret) {
    throw new UnauthorizedError("TOTP_INVALID", "MFA not configured");
  }

  const valid = authenticator.verify({ token: totpCode, secret: user.totp_secret });
  if (!valid) throw new UnauthorizedError("TOTP_INVALID", "Invalid TOTP code");

  const permissions = user.role.permissions.map((p) => p.permission);

  const accessToken = fastify.jwt.sign(
    {
      sub: user.id,
      type: "admin",
      organization_id: user.organization_id,
      role_id: user.role_id,
      permissions,
    },
    { expiresIn: config.JWT_ACCESS_TTL },
  );

  const refreshToken = fastify.jwt.sign(
    { sub: user.id, type: "admin_refresh" },
    { expiresIn: `${config.ADMIN_REFRESH_TTL_HOURS}h` },
  );

  const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + config.ADMIN_REFRESH_TTL_HOURS * 3600_000);
  await prisma.refreshToken.create({
    data: { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt },
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    admin: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: { id: user.role.id, name: user.role.name },
      permissions,
    },
  };
}

export async function setupMfa(
  userId: string,
  email: string,
  orgName: string,
  redis: Redis,
): Promise<{ qr_code: string; otpauth_uri: string }> {
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(email, `Pulpito (${orgName})`, secret);
  const qrCode = await QRCode.toDataURL(uri);

  await redis.set(`mfa:setup:${userId}`, secret, "EX", 600);

  return { qr_code: qrCode, otpauth_uri: uri };
}

export async function confirmMfa(
  userId: string,
  totpCode: string,
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const secret = await redis.get(`mfa:setup:${userId}`);
  if (!secret) throw new ValidationError("MFA_TOKEN_INVALID", "MFA setup session expired");

  const valid = authenticator.verify({ token: totpCode, secret });
  if (!valid) throw new UnauthorizedError("TOTP_INVALID", "Invalid TOTP code");

  await prisma.user.update({
    where: { id: userId },
    data: { totp_secret: secret, mfa_enabled: true },
  });

  await redis.del(`mfa:setup:${userId}`);
}

export async function refreshTokens(
  refreshToken: string,
  prisma: PrismaClient,
  fastify: FastifyInstance,
): Promise<{ access_token: string; refresh_token: string }> {
  let payload: { sub: string; type: string };
  try {
    payload = fastify.jwt.verify<{ sub: string; type: string }>(refreshToken);
  } catch {
    throw new UnauthorizedError("TOKEN_REVOKED", "Invalid or expired refresh token");
  }

  const isInterpreter = payload.type === "interpreter_refresh";
  const isAdmin = payload.type === "admin_refresh";
  if (!isInterpreter && !isAdmin) {
    throw new UnauthorizedError("TOKEN_REVOKED", "Invalid token type");
  }

  const allTokens = await prisma.refreshToken.findMany({
    where: isInterpreter
      ? { interpreter_id: payload.sub, revoked_at: null }
      : { user_id: payload.sub, revoked_at: null },
  });

  let matchedToken = null;
  for (const t of allTokens) {
    if (await bcrypt.compare(refreshToken, t.token_hash)) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken || matchedToken.expires_at < new Date()) {
    throw new UnauthorizedError("TOKEN_REVOKED", "Refresh token expired or revoked");
  }

  await prisma.refreshToken.update({
    where: { id: matchedToken.id },
    data: { revoked_at: new Date() },
  });

  if (isInterpreter) {
    const interpreter = await prisma.interpreter.findUnique({ where: { id: payload.sub } });
    if (!interpreter) throw new UnauthorizedError("TOKEN_REVOKED", "Account not found");

    const newAccess = fastify.jwt.sign(
      { sub: interpreter.id, type: "interpreter", organization_id: interpreter.organization_id },
      { expiresIn: config.JWT_ACCESS_TTL },
    );
    const newRefresh = fastify.jwt.sign(
      { sub: interpreter.id, type: "interpreter_refresh" },
      { expiresIn: `${config.JWT_REFRESH_TTL_DAYS}d` },
    );
    const tokenHash = await bcrypt.hash(newRefresh, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL_DAYS * 86400_000);
    await prisma.refreshToken.create({
      data: { interpreter_id: interpreter.id, token_hash: tokenHash, expires_at: expiresAt },
    });
    return { access_token: newAccess, refresh_token: newRefresh };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: true } } },
  });
  if (!user) throw new UnauthorizedError("TOKEN_REVOKED", "Account not found");

  const permissions = user.role.permissions.map((p) => p.permission);
  const newAccess = fastify.jwt.sign(
    { sub: user.id, type: "admin", organization_id: user.organization_id, role_id: user.role_id, permissions },
    { expiresIn: config.JWT_ACCESS_TTL },
  );
  const newRefresh = fastify.jwt.sign(
    { sub: user.id, type: "admin_refresh" },
    { expiresIn: `${config.ADMIN_REFRESH_TTL_HOURS}h` },
  );
  const tokenHash = await bcrypt.hash(newRefresh, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + config.ADMIN_REFRESH_TTL_HOURS * 3600_000);
  await prisma.refreshToken.create({
    data: { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt },
  });
  return { access_token: newAccess, refresh_token: newRefresh };
}

export async function logout(
  userId: string,
  isInterpreter: boolean,
  prisma: PrismaClient,
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: isInterpreter ? { interpreter_id: userId, revoked_at: null } : { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function requestPasswordReset(
  email: string,
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, is_active: true },
  });
  if (!user) return; // silent

  const token = crypto.randomUUID();
  await redis.set(`pwd_reset:${token}`, user.id, "EX", 3600);
  // TODO: send via SendGrid
  if (config.NODE_ENV === "development") {
    console.warn(`[DEV] Password reset token for ${email}: ${token}`);
  }
}

export async function confirmPasswordReset(
  resetToken: string,
  newPassword: string,
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const userId = await redis.get(`pwd_reset:${resetToken}`);
  if (!userId) throw new UnauthorizedError("RESET_TOKEN_INVALID", "Reset token expired or invalid");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("NOT_FOUND", "Account not found");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password_hash: passwordHash } });
  await prisma.refreshToken.updateMany({ where: { user_id: userId }, data: { revoked_at: new Date() } });
  await redis.del(`pwd_reset:${resetToken}`);
}
