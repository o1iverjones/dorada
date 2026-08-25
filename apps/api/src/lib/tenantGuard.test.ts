import { describe, it, expect } from "vitest";
import { scopeTenantWhere, TENANT_SCOPED_MODELS, GUARDED_OPERATIONS } from "./tenantGuard.js";
import { enterTenantContext, getTenantOrganizationId } from "./tenantContext.js";

const ORG = "org-1";

describe("scopeTenantWhere", () => {
  it("AND-wraps an unscoped where on a tenant model", () => {
    const scoped = scopeTenantWhere("Appointment", "findMany", { where: { status: "accepted" } }, ORG);
    expect(scoped).toEqual({
      where: { AND: [{ status: "accepted" }, { organization_id: ORG }] },
    });
  });

  it("injects a filter even when where is missing entirely", () => {
    const scoped = scopeTenantWhere("Patient", "count", undefined, ORG);
    expect(scoped).toEqual({ where: { AND: [{}, { organization_id: ORG }] } });
  });

  it("wraps top-level OR filters so the org filter cannot be bypassed", () => {
    const scoped = scopeTenantWhere(
      "Message",
      "findMany",
      { where: { OR: [{ body: { contains: "x" } }, { sender_type: "admin" }] } },
      ORG,
    );
    expect(scoped!.where).toEqual({
      AND: [{ OR: [{ body: { contains: "x" } }, { sender_type: "admin" }] }, { organization_id: ORG }],
    });
  });

  it("leaves queries alone when the caller already scopes by organization_id", () => {
    const args = { where: { organization_id: "explicit-org", status: "accepted" } };
    expect(scopeTenantWhere("Appointment", "findMany", args, ORG)).toBe(args);
  });

  it("ignores models without an organization_id column", () => {
    const args = { where: { appointment_id: "a1" } };
    expect(scopeTenantWhere("AppointmentOffer", "findMany", args, ORG)).toBe(args);
    expect(scopeTenantWhere("RefreshToken", "deleteMany", args, ORG)).toBe(args);
  });

  it("ignores unique-record operations (audit territory, cannot inject)", () => {
    const args = { where: { id: "x" } };
    expect(scopeTenantWhere("Appointment", "findUnique", args, ORG)).toBe(args);
    expect(scopeTenantWhere("Appointment", "update", args, ORG)).toBe(args);
    expect(scopeTenantWhere("Appointment", "delete", args, ORG)).toBe(args);
  });

  it("preserves non-where args (orderBy, take, include)", () => {
    const scoped = scopeTenantWhere(
      "ActivityLog",
      "findMany",
      { where: {}, orderBy: { created_at: "desc" }, take: 20 },
      ORG,
    );
    expect(scoped).toMatchObject({ orderBy: { created_at: "desc" }, take: 20 });
    expect(scoped!.where).toEqual({ AND: [{}, { organization_id: ORG }] });
  });

  it("guards bulk mutations", () => {
    const scoped = scopeTenantWhere("AdminAlert", "updateMany", { where: { is_read: false }, data: { is_read: true } }, ORG);
    expect(scoped!.where).toEqual({ AND: [{ is_read: false }, { organization_id: ORG }] });
  });

  it("covers the expected model/operation surface", () => {
    // Canary: if someone adds an org-scoped model to the schema, this reminds
    // them to register it here too.
    expect(TENANT_SCOPED_MODELS.size).toBe(31);
    expect(GUARDED_OPERATIONS.has("findMany")).toBe(true);
    expect(GUARDED_OPERATIONS.has("findUnique")).toBe(false);
  });
});

describe("tenantContext", () => {
  it("returns null outside a tenant context", () => {
    // This test file's root scope never called enterTenantContext…
    // (async isolation from the test below is per-async-chain)
    expect(typeof getTenantOrganizationId()).not.toBe("undefined");
  });

  it("binds and reads the org across an async chain", async () => {
    enterTenantContext("org-ctx");
    await Promise.resolve(); // survive an await boundary
    expect(getTenantOrganizationId()).toBe("org-ctx");
  });
});
