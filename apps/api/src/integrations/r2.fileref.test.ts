import { describe, it, expect, vi, beforeEach } from "vitest";

// Configure R2 env BEFORE importing the module under test so config picks it up.
process.env.R2_PUBLIC_URL = "https://pub-test123.r2.dev";
process.env.R2_BUCKET = "dorada-media";

const { keyFromFileRef, normalizeFileRef, resolveFileUrl } = await import("./r2.js");

beforeEach(() => vi.restoreAllMocks());

describe("keyFromFileRef", () => {
  it("passes bare R2 keys through", () => {
    expect(keyFromFileRef("dorada/notes/clinic/c1/img.jpg")).toBe("dorada/notes/clinic/c1/img.jpg");
    expect(keyFromFileRef("avatars/user/u1/pic.png")).toBe("avatars/user/u1/pic.png");
  });

  it("extracts the key from legacy public URLs", () => {
    expect(keyFromFileRef("https://pub-test123.r2.dev/dorada/messages/i1/img.jpg")).toBe(
      "dorada/messages/i1/img.jpg",
    );
  });

  it("extracts the key from a presigned URL echoed back by a client", () => {
    const signed =
      "https://acct.r2.cloudflarestorage.com/dorada-media/dorada/notes/patient/p1/img.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=abc";
    expect(keyFromFileRef(signed)).toBe("dorada/notes/patient/p1/img.jpg");
  });

  it("returns null for non-R2 references", () => {
    expect(keyFromFileRef("/uploads/images/x.jpg")).toBeNull();
    expect(keyFromFileRef("data:image/png;base64,AAAA")).toBeNull();
    expect(keyFromFileRef("https://example.com/photo.jpg")).toBeNull();
    expect(keyFromFileRef(null)).toBeNull();
    expect(keyFromFileRef(undefined)).toBeNull();
    expect(keyFromFileRef("")).toBeNull();
  });
});

describe("normalizeFileRef", () => {
  it("normalizes any R2 form to the bare key", () => {
    expect(normalizeFileRef("https://pub-test123.r2.dev/dorada/x/y.jpg")).toBe("dorada/x/y.jpg");
    expect(normalizeFileRef("dorada/x/y.jpg")).toBe("dorada/x/y.jpg");
  });
  it("leaves non-R2 references untouched", () => {
    expect(normalizeFileRef("/uploads/images/x.jpg")).toBe("/uploads/images/x.jpg");
    expect(normalizeFileRef(null)).toBeNull();
  });
});

describe("resolveFileUrl", () => {
  it("returns null for empty refs", async () => {
    expect(await resolveFileUrl(null)).toBeNull();
    expect(await resolveFileUrl(undefined)).toBeNull();
  });

  it("passes through local dev paths and data URLs unchanged", async () => {
    expect(await resolveFileUrl("/uploads/images/x.jpg")).toBe("/uploads/images/x.jpg");
    expect(await resolveFileUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("passes R2 refs through unchanged when R2 is not configured (dev)", async () => {
    // Test env has no R2_ACCOUNT_ID — signing is impossible, and the ref
    // must survive rather than throw.
    expect(await resolveFileUrl("dorada/notes/clinic/c1/img.jpg")).toBe(
      "dorada/notes/clinic/c1/img.jpg",
    );
  });
});
