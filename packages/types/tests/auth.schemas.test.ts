import { describe, it, expect } from "vitest";
import {
  RequestOtpBodySchema,
  VerifyOtpBodySchema,
  PasswordResetConfirmBodySchema,
} from "../src/auth.js";
import { AgencyListQuerySchema } from "../src/agency.js";

describe("RequestOtpBodySchema (email)", () => {
  it("accepts a valid email", () => {
    expect(RequestOtpBodySchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });
  it.each(["not-an-email", "", "user@", "@example.com"])(
    "rejects %s",
    (email) => {
      expect(RequestOtpBodySchema.safeParse({ email }).success).toBe(false);
    },
  );
});

describe("VerifyOtpBodySchema", () => {
  const email = "user@example.com";
  it("accepts a 6-digit code", () => {
    expect(VerifyOtpBodySchema.safeParse({ email, otp: "123456" }).success).toBe(true);
  });
  it.each(["12345", "1234567", "abcdef", "12 456"])("rejects %s", (otp) => {
    expect(VerifyOtpBodySchema.safeParse({ email, otp }).success).toBe(false);
  });
});

describe("PasswordResetConfirmBodySchema password policy", () => {
  const base = { reset_token: "tok" };
  it("accepts >=10 chars with upper, lower, and digit", () => {
    expect(
      PasswordResetConfirmBodySchema.safeParse({ ...base, new_password: "ValidPassword1" }).success,
    ).toBe(true);
  });
  it.each([
    ["Short1a", "too short"],
    ["alllowercase1", "no uppercase"],
    ["ALLUPPERCASE1", "no lowercase"],
    ["NoDigitsHere", "no digit"],
  ])("rejects %s (%s)", (new_password) => {
    expect(PasswordResetConfirmBodySchema.safeParse({ ...base, new_password }).success).toBe(false);
  });
});

describe("AgencyListQuerySchema", () => {
  it("coerces include_inactive and limit from query strings", () => {
    const parsed = AgencyListQuerySchema.parse({ include_inactive: "true", limit: "50" });
    expect(parsed.include_inactive).toBe(true);
    expect(parsed.limit).toBe(50);
  });
  it("defaults limit to 25 and leaves include_inactive undefined", () => {
    const parsed = AgencyListQuerySchema.parse({});
    expect(parsed.limit).toBe(25);
    expect(parsed.include_inactive).toBeUndefined();
  });
  it("caps limit at 500", () => {
    expect(AgencyListQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
  });
});
