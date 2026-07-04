import { describe, it, expect, vi, beforeEach } from "vitest";

// Configure R2 env BEFORE importing the module under test so config picks it up.
// Bucket is deliberately named "dorada" — same as the key root — to lock in the
// virtual-hosted vs path-style regression that broke note images on dev.
process.env.R2_ACCOUNT_ID = "abc123account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_ID = "test-secret-key";
process.env.R2_PUBLIC_URL = "https://pub-test123.r2.dev";
process.env.R2_BUCKET = "dorada";

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

  it("extracts the key from a virtual-hosted presigned URL (bucket in hostname)", () => {
    // The real dev failure: bucket "dorada" in the host, key "dorada/notes/…"
    // in the path. The path IS the key and must NOT be truncated.
    const signed =
      "https://dorada.abc123account.r2.cloudflarestorage.com/dorada/notes/appointment/a1/img.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=abc";
    expect(keyFromFileRef(signed)).toBe("dorada/notes/appointment/a1/img.jpeg");
  });

  it("extracts the key from a path-style presigned URL (bucket in path)", () => {
    const signed =
      "https://abc123account.r2.cloudflarestorage.com/dorada/dorada/notes/patient/p1/img.jpg?X-Amz-Signature=abc";
    expect(keyFromFileRef(signed)).toBe("dorada/notes/patient/p1/img.jpg");
  });

  it("extracts avatar keys from a virtual-hosted presigned URL", () => {
    const signed =
      "https://dorada.abc123account.r2.cloudflarestorage.com/avatars/user/u1/pic.png?X-Amz-Signature=abc";
    expect(keyFromFileRef(signed)).toBe("avatars/user/u1/pic.png");
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

  it("signs a bare key into a virtual-hosted URL that round-trips back to the same key", async () => {
    const signed = await resolveFileUrl("dorada/notes/clinic/c1/img.jpg");
    expect(signed).toMatch(/^https:\/\/dorada\.abc123account\.r2\.cloudflarestorage\.com\//);
    expect(signed).toContain("X-Amz-Signature=");
    // The signed URL a client would echo back must normalize to the original key.
    expect(keyFromFileRef(signed)).toBe("dorada/notes/clinic/c1/img.jpg");
  });

  it("round-trips a signed avatar key (regression: bucket name == key root)", async () => {
    const signed = await resolveFileUrl("avatars/interpreter/i1/pic.png");
    expect(keyFromFileRef(signed)).toBe("avatars/interpreter/i1/pic.png");
  });
});
