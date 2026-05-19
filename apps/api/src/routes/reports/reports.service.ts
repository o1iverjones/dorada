import type { PrismaClient } from "@prisma/client";
import type { GenerateReportBody, ReportListQuery } from "@dorada/types";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Queue } from "bullmq";

const REQUIRED_FILTERS: Record<string, string[]> = {
  interpreter_compensation: ["date_from", "date_to"],
  insurance_agency_billing: ["date_from", "date_to"],
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
    download_url: job.download_url ?? null,
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
      download_url: j.download_url ?? null,
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
