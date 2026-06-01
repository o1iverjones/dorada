import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GenerateReportBodySchema, ReportListQuerySchema } from "@dorada/types";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { generateReport, getReportStatus, listReports } from "./reports.service.js";
import { getQueues } from "../../workers/queues.js";
import { writeActivityLog } from "../../lib/activityLog.js";

const LOCAL_REPORTS_DIR = path.join(os.tmpdir(), "dorada-reports");

export default async function reportRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticateAdmin, requirePermission("view_reports")];

  fastify.get("/", { preHandler }, async (req, reply) => {
    const query = ReportListQuerySchema.parse(req.query);
    const payload = req.user as JwtPayload;
    return reply.send(await listReports(query, payload.organization_id, fastify.prisma));
  });

  fastify.post("/", { preHandler }, async (req, reply) => {
    const body = GenerateReportBodySchema.parse(req.body);
    const payload = req.user as JwtPayload;
    const { reportGenerationQueue } = getQueues();
    const result = await generateReport(body, payload.organization_id, payload.sub, fastify.prisma, reportGenerationQueue);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "report", entityId: result.job_id, entityName: body.type, action: "generated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(202).send(result);
  });

  fastify.get("/:job_id", { preHandler }, async (req, reply) => {
    const { job_id } = req.params as { job_id: string };
    return reply.send(await getReportStatus(job_id, (req.user as JwtPayload).organization_id, fastify.prisma));
  });

  /** Dev-only: serve locally saved report files when GCS is not configured. */
  fastify.get("/:job_id/download", { preHandler }, async (req, reply) => {
    const { job_id } = req.params as { job_id: string };
    const job = await fastify.prisma.reportJob.findFirst({
      where: { id: job_id, organization_id: (req.user as JwtPayload).organization_id },
    });
    if (!job) return reply.status(404).send({ error: "Not found" });

    // Only serve local files (no gcs_path stored)
    if (job.gcs_path) return reply.status(400).send({ error: "Use signed URL for GCS files" });

    const filename = `${job_id}.${job.format}`;
    const filepath = path.join(LOCAL_REPORTS_DIR, filename);
    if (!fs.existsSync(filepath)) return reply.status(404).send({ error: "File not found on disk" });

    const contentType = job.format === "csv" ? "text/csv" : "application/pdf";
    const downloadName = `report-${job.type}-${job_id.slice(0, 8)}.${job.format}`;
    return reply
      .header("Content-Type", contentType)
      .header("Content-Disposition", `attachment; filename="${downloadName}"`)
      .send(fs.createReadStream(filepath));
  });
}
