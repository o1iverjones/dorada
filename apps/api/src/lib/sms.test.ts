import { describe, it, expect, vi, afterEach } from "vitest";
import { sendSms } from "./sms.js";

afterEach(() => vi.restoreAllMocks());

describe("sendSms", () => {
  it("no-ops without calling Sinch when credentials are not configured", async () => {
    // Test env has no SINCH_* vars — sendSms must not attempt a network call.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(sendSms("+15555550100", "test message")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never throws even if fetch would fail (SMS failures must not crash requests)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(sendSms("+15555550100", "test message")).resolves.toBeUndefined();
  });
});
