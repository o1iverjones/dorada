import { describe, it, expect } from "vitest";
import { formatPhone, formatPhoneInput, telHref } from "./phone.js";

describe("formatPhone", () => {
  it("formats a bare 10-digit number", () => {
    expect(formatPhone("8312388020")).toBe("(831) 238-8020");
  });
  it("strips a leading country code 1", () => {
    expect(formatPhone("18312388020")).toBe("(831) 238-8020");
    expect(formatPhone("+18312388020")).toBe("(831) 238-8020");
  });
  it("re-formats an already formatted number", () => {
    expect(formatPhone("(831) 238-8020")).toBe("(831) 238-8020");
    expect(formatPhone("831-238-8020")).toBe("(831) 238-8020");
  });
  it("returns em dash for empty values", () => {
    expect(formatPhone(null)).toBe("—");
    expect(formatPhone(undefined)).toBe("—");
    expect(formatPhone("")).toBe("—");
  });
  it("passes through values it cannot format", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });
});

describe("formatPhoneInput (progressive)", () => {
  it("builds up as the user types", () => {
    expect(formatPhoneInput("8")).toBe("(8");
    expect(formatPhoneInput("831")).toBe("(831");
    expect(formatPhoneInput("8312")).toBe("(831) 2");
    expect(formatPhoneInput("831238")).toBe("(831) 238");
    expect(formatPhoneInput("8312388020")).toBe("(831) 238-8020");
  });
  it("allows more than 10 digits for international numbers", () => {
    expect(formatPhoneInput("83123880209999")).toBe("83123880209999");
  });
  it("strips non-digits", () => {
    expect(formatPhoneInput("abc831!238-8020")).toBe("(831) 238-8020");
  });
  it("returns empty string for no digits", () => {
    expect(formatPhoneInput("")).toBe("");
    expect(formatPhoneInput("abc")).toBe("");
  });
});

describe("telHref", () => {
  it("normalizes 10- and 11-digit US numbers", () => {
    expect(telHref("8312388020")).toBe("tel:+18312388020");
    expect(telHref("(831) 238-8020")).toBe("tel:+18312388020");
    expect(telHref("18312388020")).toBe("tel:+18312388020");
  });
  it("returns null when it cannot normalize", () => {
    expect(telHref("12345")).toBeNull();
    expect(telHref(null)).toBeNull();
  });
});
