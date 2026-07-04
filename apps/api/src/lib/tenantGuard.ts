import type { PrismaClient } from "@prisma/client";
import { getTenantOrganizationId } from "./tenantContext.js";

/**
 * Defense-in-depth tenant isolation.
 *
 * Every route already scopes queries manually (ensureTenant / explicit
 * organization_id filters) — that remains the primary control. This guard
 * exists so that a FORGOTTEN check on a new endpoint fails closed instead of
 * leaking another org's rows: inside an authenticated request, list/bulk
 * queries on org-scoped models are automatically AND-ed with the requester's
 * organization_id.
 *
 * Deliberately NOT covered (Prisma requires a unique `where` there, so an
 * org filter cannot be injected): findUnique / update / delete on single
 * records. Those remain the audit's territory — every current call site
 * fetch-then-checks organization_id before mutating.
 */

/** Models that carry an organization_id column (keep in sync with schema.prisma). */
export const TENANT_SCOPED_MODELS = new Set([
  "User",
  "Role",
  "Interpreter",
  "InterpreterNote",
  "Clinic",
  "Agency",
  "Patient",
  "Claim",
  "InsuranceCompany",
  "InsuranceCompanyNote",
  "PatientNote",
  "AppointmentType",
  "Appointment",
  "AppointmentMedia",
  "AppointmentActivity",
  "ActivityLog",
  "AppointmentNote",
  "ClinicNote",
  "AgencyNote",
  "EmailIntakeLog",
  "ReportJob",
  "Message",
  "OrganizationLanguage",
  "LocaleString",
  "SystemSettings",
  "AppointmentReminderConfig",
  "AdminAlert",
  "InterpreterRate",
  "Invoice",
  "SuperAdminSettings",
  "City",
]);

/** Operations whose `where` accepts arbitrary filters (an org filter can be injected). */
export const GUARDED_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

interface QueryArgs {
  where?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Inject the tenant filter into a query's `where` unless the call site
 * already filters by organization_id at the top level. Pure — unit tested.
 */
export function scopeTenantWhere(
  model: string,
  operation: string,
  args: QueryArgs | undefined,
  organizationId: string,
): QueryArgs | undefined {
  if (!TENANT_SCOPED_MODELS.has(model) || !GUARDED_OPERATIONS.has(operation)) return args;
  const where = args?.where ?? {};
  if ("organization_id" in where) return args; // explicitly scoped by the caller
  return { ...args, where: { AND: [where, { organization_id: organizationId }] } };
}

/** Wrap the Prisma client with the tenant guard extension. */
export function withTenantGuard(client: PrismaClient): PrismaClient {
  return client.$extends({
    name: "tenantGuard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const organizationId = getTenantOrganizationId();
          if (!organizationId) return query(args);
          return query(scopeTenantWhere(model, operation, args as QueryArgs, organizationId) as typeof args);
        },
      },
    },
  }) as unknown as PrismaClient;
}
