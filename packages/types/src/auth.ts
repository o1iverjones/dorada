import { z } from "zod";
import { UuidSchema } from "./common.js";

export const RequestOtpBodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format"),
});

export const VerifyOtpBodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().length(6).regex(/^\d{6}$/),
});

export const AdminLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const AdminMfaVerifyBodySchema = z.object({
  mfa_token: z.string().min(1),
  totp_code: z.string().length(6).regex(/^\d{6}$/),
});

export const AdminMfaConfirmBodySchema = z.object({
  totp_code: z.string().length(6).regex(/^\d{6}$/),
});

export const RefreshTokenBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const PasswordResetRequestBodySchema = z.object({
  email: z.string().email(),
});

export const PasswordResetConfirmBodySchema = z.object({
  reset_token: z.string().min(1),
  new_password: z
    .string()
    .min(10)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and a digit"),
});

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});

export const InterpreterAuthResponseSchema = TokenPairSchema.extend({
  interpreter: z.object({
    id: UuidSchema,
    name: z.string(),
    phone: z.string(),
  }),
});

export const AdminAuthResponseSchema = TokenPairSchema.extend({
  admin: z.object({
    id: UuidSchema,
    name: z.string(),
    email: z.string().email(),
    role: z.object({ id: UuidSchema, name: z.string() }),
    permissions: z.array(z.string()),
  }),
});

export type RequestOtpBody = z.infer<typeof RequestOtpBodySchema>;
export type VerifyOtpBody = z.infer<typeof VerifyOtpBodySchema>;
export type AdminLoginBody = z.infer<typeof AdminLoginBodySchema>;
export type AdminMfaVerifyBody = z.infer<typeof AdminMfaVerifyBodySchema>;
export type AdminMfaConfirmBody = z.infer<typeof AdminMfaConfirmBodySchema>;
export type RefreshTokenBody = z.infer<typeof RefreshTokenBodySchema>;
export type PasswordResetRequestBody = z.infer<typeof PasswordResetRequestBodySchema>;
export type PasswordResetConfirmBody = z.infer<typeof PasswordResetConfirmBodySchema>;
export type TokenPair = z.infer<typeof TokenPairSchema>;
export type InterpreterAuthResponse = z.infer<typeof InterpreterAuthResponseSchema>;
export type AdminAuthResponse = z.infer<typeof AdminAuthResponseSchema>;
