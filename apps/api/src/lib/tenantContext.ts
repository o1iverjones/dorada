import { AsyncLocalStorage } from "async_hooks";

/**
 * Per-request tenant context, set by the auth middleware after JWT
 * verification and read by the Prisma tenant guard (see tenantGuard.ts).
 *
 * Background jobs / workers / unauthenticated routes never enter a tenant
 * context, so their queries are not scoped — they are trusted code paths
 * that manage organization_id explicitly.
 */
interface TenantStore {
  organizationId: string;
}

const als = new AsyncLocalStorage<TenantStore>();

/** Bind the current request's async chain to an organization. */
export function enterTenantContext(organizationId: string): void {
  als.enterWith({ organizationId });
}

/** The organization bound to the current async chain, or null outside a request. */
export function getTenantOrganizationId(): string | null {
  return als.getStore()?.organizationId ?? null;
}
