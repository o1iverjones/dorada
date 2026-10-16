import type { PrismaClient } from "@prisma/client";
import type { GenerateReportBody, ReportListQuery, ReportPreviewBody } from "@dorada/types";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Queue } from "bullmq";

/**
 * Always return the API proxy URL so the frontend fetches through the
 * authenticated endpoint (avoids R2 CORS issues with direct signed URLs).
 */
function reportDownloadUrl(job: { id: string; gcs_path: string | null; download_url: string | null; status: string }): string | null {
  if (job.status !== "completed") return null;
  if (job.gcs_path || job.download_url) return `/api/v1/reports/${job.id}/download`;
  return null;
}

// ─── Data fetching (shared by worker + preview) ─────────────────────────────

export async function fetchReportData(
  type: string,
  organizationId: string,
  filters: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<Record<string, unknown>[]> {
  const dateFrom = filters["date_from"] ? new Date(filters["date_from"] as string) : undefined;
  const dateTo = filters["date_to"] ? new Date(`${filters["date_to"] as string}T23:59:59Z`) : undefined;
  const dateFilter = dateFrom || dateTo
    ? { date_time: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
    : {};

  if (type === "interpreter_compensation") {
    const interpreterIds = filters["interpreter_ids"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        status: "completed",
        ...dateFilter,
        ...(interpreterIds?.length ? { interpreter_id: { in: interpreterIds } } : {}),
      },
      include: { interpreter: true, clinic: true, type: true, invoice: true },
      orderBy: [{ interpreter: { name: "asc" } }, { date_time: "asc" }],
    });

    let defaultRates: { qualified: number; certified: number } | null = null;
    const needsDefault = appointments.some((a) => !a.invoice?.pay_rate && !a.pay_rate && !a.interpreter?.pay_rate);
    if (needsDefault) {
      const settings = await prisma.systemSettings.findUnique({ where: { organization_id: organizationId } });
      defaultRates = {
        qualified: settings ? Number(settings.default_pay_rate_qualified) : 30,
        certified: settings ? Number(settings.default_pay_rate_certified) : 40,
      };
    }

    return appointments.map((a) => {
      const rate = a.invoice?.pay_rate
        ? Number(a.invoice.pay_rate)
        : a.pay_rate
          ? Number(a.pay_rate)
          : a.interpreter?.pay_rate
            ? Number(a.interpreter.pay_rate)
            : defaultRates
              ? (a.interpreter_type_required.toLowerCase() === "qualified" ? defaultRates.qualified : defaultRates.certified)
              : 0;
      const billable = a.billable_duration_minutes ?? 0;
      return {
        date: a.date_time.toISOString().slice(0, 10),
        interpreter: a.interpreter?.name ?? "—",
        clinic: a.clinic.name,
        appointment_type: a.type.name,
        clocked_minutes: a.actual_duration_minutes ?? 0,
        billable_minutes: billable,
        rate_per_hour: rate,
        amount: Number(((billable / 60) * rate).toFixed(2)),
      };
    });
  }

  if (type === "agency_billing") {
    const agencyIds = filters["agency_ids"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        status: "completed",
        ...dateFilter,
        ...(agencyIds?.length ? { agency_id: { in: agencyIds } } : {}),
      },
      include: { patient: true, clinic: true, interpreter: true, agency: true, invoice: true },
      orderBy: [{ agency: { name: "asc" } }, { date_time: "asc" }],
    });
    return appointments.map((a) => {
      const actualAmount = a.invoice?.amount
        ? Number(a.invoice.amount)
        : Number((((a.billable_duration_minutes ?? 0) / 60) * Number(a.pay_rate ?? 0)).toFixed(2));
      return {
        date: a.date_time.toISOString().slice(0, 10),
        agency: a.agency?.name ?? "—",
        patient: a.patient.name,
        clinic: a.clinic.name,
        interpreter: a.interpreter?.name ?? "—",
        pre_auth_amount: a.pre_auth_amount ?? 0,
        pre_auth_mileage: a.pre_auth_mileage ?? 0,
        actual_amount: actualAmount,
      };
    });
  }

  if (type === "appointment_history") {
    const statuses = filters["statuses"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        ...dateFilter,
        ...(statuses?.length ? { status: { in: statuses } } : {}),
      },
      include: { patient: true, clinic: true, interpreter: true, type: true },
      orderBy: { date_time: "asc" },
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString().slice(0, 10),
      patient: a.patient.name,
      clinic: a.clinic.name,
      interpreter: a.interpreter?.name ?? "—",
      language: a.language,
      appointment_type: a.type.name,
      status: a.status,
      duration_minutes: a.actual_duration_minutes ?? a.duration_minutes,
    }));
  }

  if (type === "interpreter_performance") {
    const interpreterIds = filters["interpreter_ids"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        ...dateFilter,
        ...(interpreterIds?.length ? { interpreter_id: { in: interpreterIds } } : {}),
      },
      include: { interpreter: true },
      orderBy: [{ interpreter: { name: "asc" } }, { date_time: "asc" }],
    });
    return appointments.map((a) => ({
      interpreter: a.interpreter?.name ?? "—",
      date: a.date_time.toISOString().slice(0, 10),
      status: a.status,
      scheduled_time: a.date_time.toISOString().slice(11, 16),
      clock_in_time: a.clock_in_time ? a.clock_in_time.toISOString().slice(11, 16) : "—",
      hours_worked: ((a.actual_duration_minutes ?? 0) / 60).toFixed(2),
    }));
  }

  return [];
}

export async function previewReport(
  body: ReportPreviewBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const required = REQUIRED_FILTERS[body.type] ?? [];
  for (const field of required) {
    const val = body.filters[field as keyof typeof body.filters];
    if (!val || (Array.isArray(val) && val.length === 0)) {
      throw new ValidationError("MISSING_REQUIRED_FILTER", `Filter required: ${field}`);
    }
  }

  const allRows = await fetchReportData(body.type, organizationId, body.filters as Record<string, unknown>, prisma);
  const total = allRows.length;
  const start = (body.page - 1) * body.limit;
  const rows = allRows.slice(start, start + body.limit);
  const columns = total > 0
    ? Object.keys(allRows[0]!).map((key) => ({ key, label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))
    : [];

  return {
    columns,
    data: rows,
    pagination: {
      page: body.page,
      total,
      total_pages: Math.ceil(total / body.limit),
      has_more: start + body.limit < total,
    },
  };
}

const REQUIRED_FILTERS: Record<string, string[]> = {
  interpreter_compensation: ["date_from", "date_to"],
  agency_billing: ["date_from", "date_to"],
  appointment_history: ["date_from", "date_to"],
  interpreter_performance: ["date_from", "date_to"],
};

export async function generateReport(
  body: GenerateReportBody,
  organizationId: string,
  userId: string,
  prisma: PrismaClient,
  reportQueue: Queue,
) {
  const required = REQUIRED_FILTERS[body.type] ?? [];
  for (const field of required) {
    const val = body.filters[field as keyof typeof body.filters];
    if (!val || (Array.isArray(val) && val.length === 0)) {
      throw new ValidationError("MISSING_REQUIRED_FILTER", `Filter required: ${field}`);
    }
  }

  // Create the DB record first so the worker can update it
  const reportJob = await prisma.reportJob.create({
    data: {
      organization_id: organizationId,
      requested_by: userId,
      type: body.type,
      format: body.format ?? "pdf",
      filters: body.filters as object,
      status: "pending",
    },
  });

  await reportQueue.add(
    "generate-report",
    {
      reportJobId: reportJob.id,
      organizationId,
      requestedBy: userId,
      type: body.type,
      format: body.format ?? "pdf",
      locale: body.locale ?? "en",
      filters: body.filters,
      options: body.options,
    },
    { jobId: reportJob.id },
  );

  return { job_id: reportJob.id, status: "pending", estimated_seconds: 10 };
}

export async function getReportStatus(jobId: string, organizationId: string, prisma: PrismaClient) {
  const job = await prisma.reportJob.findFirst({
    where: { id: jobId, organization_id: organizationId },
  });
  if (!job) throw new NotFoundError("REPORT_NOT_FOUND", "Report not found");

  return {
    job_id: job.id,
    status: job.status,
    type: job.type,
    format: job.format,
    filters: job.filters,
    download_url: reportDownloadUrl(job),
    expires_at: null,
    error: job.error_message ?? null,
    created_at: job.created_at.toISOString(),
  };
}

export async function listReports(query: ReportListQuery, organizationId: string, prisma: PrismaClient) {
  const limit = query.limit ?? 25;
  const jobs = await prisma.reportJob.findMany({
    where: {
      organization_id: organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.cursor ? { created_at: { lt: new Date(query.cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: limit + 1,
  });

  const hasMore = jobs.length > limit;
  const data = hasMore ? jobs.slice(0, limit) : jobs;

  return {
    data: data.map((j) => ({
      id: j.id,
      type: j.type,
      format: j.format,
      status: j.status,
      filters: j.filters,
      download_url: reportDownloadUrl(j),
      error_message: j.error_message ?? null,
      created_at: j.created_at.toISOString(),
      completed_at: j.completed_at?.toISOString() ?? null,
    })),
    pagination: {
      next_cursor: hasMore ? data[data.length - 1]!.created_at.toISOString() : null,
      has_more: hasMore,
    },
  };
}
