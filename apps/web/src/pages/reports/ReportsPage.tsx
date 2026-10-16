import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateReport, useReportJob, useReportJobs, usePreviewReport, downloadReport, buildReportFilename, buildReportLabel } from "../../hooks/useReports.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useAgencies } from "../../hooks/useAgencies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { toast } from "../../hooks/use-toast.js";
import { Download, FileText, Eye, ChevronLeft, ChevronRight, TableProperties } from "lucide-react";

const REPORT_TYPES = [
  "interpreter_compensation",
  "agency_billing",
  "appointment_history",
  "interpreter_performance",
] as const;
type ReportType = typeof REPORT_TYPES[number];

const REPORT_INFO: Record<ReportType, { title: string; description: string }> = {
  interpreter_compensation: { title: "R1 — Interpreter Compensation", description: "Compensation breakdown by interpreter, clinic, and appointment type for a date range" },
  agency_billing: { title: "R2 — Agency Billing", description: "Billing reconciliation grouped by agency" },
  appointment_history: { title: "R3 — Appointment History", description: "Full appointment history with optional status filters" },
  interpreter_performance: { title: "R4 — Interpreter Performance", description: "Attendance, on-time rate, and hours worked per interpreter" },
};

const MONEY_COLS = new Set(["amount", "actual_amount", "pre_auth_amount", "rate_per_hour"]);

export function ReportsPage() {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ReportType>("interpreter_compensation");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [interpreterIds, setInterpreterIds] = useState<string[]>([]);
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);

  const generate = useGenerateReport();
  const preview = usePreviewReport();
  const { data: job } = useReportJob(pendingJobId ?? "");
  const { data: jobHistory } = useReportJobs();
  const { data: interpreters } = useInterpreters({ limit: "100" });
  const { data: agencies } = useAgencies();

  const interpreterMap: Record<string, string> = Object.fromEntries(
    ((interpreters?.data ?? []) as Array<{ id: string; name: string }>).map((i) => [i.id, i.name])
  );

  function buildFilters(): Record<string, unknown> {
    const filters: Record<string, unknown> = { date_from: dateFrom, date_to: dateTo };
    if ((selectedType === "interpreter_compensation" || selectedType === "interpreter_performance") && interpreterIds.length) {
      filters.interpreter_ids = interpreterIds;
    }
    if (selectedType === "agency_billing" && agencyIds.length) {
      filters.agency_ids = agencyIds;
    }
    return filters;
  }

  function handlePreview(page = 1) {
    setPreviewPage(page);
    preview.mutate({ type: selectedType, filters: buildFilters(), page, limit: 50 });
  }

  async function handleGenerate() {
    setPendingJobId(null);
    try {
      const result = await generate.mutateAsync({ type: selectedType, format, filters: buildFilters() }) as { job_id: string };
      setPendingJobId(result.job_id);
      toast({ title: t("reports.generating") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const jobData = job as Record<string, unknown> | undefined;
  const previewData = preview.data as {
    columns: Array<{ key: string; label: string }>;
    data: Record<string, unknown>[];
    pagination: { page: number; total: number; total_pages: number; has_more: boolean };
  } | undefined;

  const pendingFilename = jobData
    ? buildReportFilename(
        (jobData.type as string) ?? selectedType,
        (jobData.format as string) ?? format,
        (jobData.filters as Record<string, unknown>) ?? {},
        interpreterMap,
      )
    : "";

  const canPreview = dateFrom && dateTo;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} />

      {/* Top row: Generate controls (left) + Preview table (right) */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left: Generate report controls */}
        <Card>
          <CardHeader><CardTitle>{t("reports.generate")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{t("reports.type")}</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{REPORT_INFO[type].title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{REPORT_INFO[selectedType].description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("common.date_from")}</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("common.date_to")}</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            {(selectedType === "interpreter_compensation" || selectedType === "interpreter_performance") && (() => {
              const allIds = ((interpreters?.data ?? []) as Array<{ id: string; name: string }>).map((i) => i.id);
              const allSelected = allIds.length > 0 && allIds.every((id) => interpreterIds.includes(id));
              return (
                <div className="space-y-1">
                  <Label>{t("reports.select_interpreters")}</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium border-b pb-1 mb-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setInterpreterIds(allSelected ? [] : allIds)}
                      />
                      Select all
                    </label>
                    {((interpreters?.data ?? []) as Array<{ id: string; name: string }>).map((i) => (
                      <label key={i.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={interpreterIds.includes(i.id)}
                          onChange={(e) => setInterpreterIds(e.target.checked ? [...interpreterIds, i.id] : interpreterIds.filter((x) => x !== i.id))}
                        />
                        {i.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}

            {selectedType === "agency_billing" && (() => {
              const allIds = ((agencies?.data ?? []) as Array<{ id: string; name: string }>).map((a) => a.id);
              const allSelected = allIds.length > 0 && allIds.every((id) => agencyIds.includes(id));
              return (
                <div className="space-y-1">
                  <Label>{t("reports.select_agencies")}</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium border-b pb-1 mb-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setAgencyIds(allSelected ? [] : allIds)}
                      />
                      Select all
                    </label>
                    {((agencies?.data ?? []) as Array<{ id: string; name: string }>).map((a) => (
                      <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={agencyIds.includes(a.id)}
                          onChange={(e) => setAgencyIds(e.target.checked ? [...agencyIds, a.id] : agencyIds.filter((x) => x !== a.id))}
                        />
                        {a.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <Button
                onClick={() => handlePreview(1)}
                disabled={preview.isPending || !canPreview}
                variant="outline"
                className="flex-1"
              >
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
              <div className="flex gap-2 flex-1">
                <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "csv")}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleGenerate} disabled={generate.isPending || !canPreview} className="flex-1">
                  <FileText className="mr-2 h-4 w-4" /> Generate
                </Button>
              </div>
            </div>

            {jobData && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {t("reports.status")}: <StatusBadge status={jobData.status as string} />
                  </span>
                  {jobData.status === "completed" && jobData.download_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadReport(jobData.download_url as string, pendingFilename)
                        .catch(() => toast({ title: t("common.error"), variant: "destructive" }))}
                    >
                      <Download className="mr-2 h-4 w-4" /> {t("reports.download")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{pendingFilename}</p>
                {jobData.status === "failed" && jobData.error && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                    {jobData.error as string}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Preview data table (always visible) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TableProperties className="h-4 w-4" />
              Data Preview
              {previewData && previewData.data.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {previewData.pagination.total} record{previewData.pagination.total !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {preview.isPending && (
              <div className="px-6 py-12 text-center text-muted-foreground">
                Loading preview…
              </div>
            )}

            {!preview.isPending && !previewData && (
              <div className="px-6 py-12 text-center text-muted-foreground">
                <TableProperties className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p>Select a report type and date range, then click <strong>Preview</strong> to see the data here.</p>
              </div>
            )}

            {!preview.isPending && previewData && previewData.data.length === 0 && (
              <div className="px-6 py-12 text-center text-muted-foreground">
                No data for the selected filters and date range.
              </div>
            )}

            {previewData && previewData.data.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {previewData.columns.map((col) => (
                          <th
                            key={col.key}
                            className={`px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap ${MONEY_COLS.has(col.key) ? "text-right" : "text-left"}`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.data.map((row, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                          {previewData.columns.map((col) => (
                            <td
                              key={col.key}
                              className={`px-4 py-2 whitespace-nowrap ${MONEY_COLS.has(col.key) ? "text-right font-mono" : ""}`}
                            >
                              {MONEY_COLS.has(col.key) ? `$${Number(row[col.key] ?? 0).toFixed(2)}` : String(row[col.key] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewPage <= 1}
                      onClick={() => handlePreview(previewPage - 1)}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> {t("common.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("common.page")} {previewPage} / {previewData.pagination.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!previewData.pagination.has_more}
                      onClick={() => handlePreview(previewPage + 1)}
                    >
                      {t("common.next")} <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report history — below, aligned left */}
      <div className="lg:max-w-[380px]">
        <Card>
          <CardHeader><CardTitle>{t("reports.history")}</CardTitle></CardHeader>
          <CardContent>
            {!jobHistory?.data.length ? (
              <p className="text-sm text-muted-foreground">{t("reports.no_history")}</p>
            ) : (
              <ul className="space-y-2">
                {(jobHistory.data as Array<Record<string, unknown>>).map((j) => {
                  const typeKey = j.type as ReportType;
                  const typeLabel = REPORT_INFO[typeKey]?.title ?? String(j.type);
                  const historyLabel = buildReportLabel(
                    j.type as string,
                    (j.filters as Record<string, unknown>) ?? {},
                    interpreterMap,
                  );
                  return (
                    <li key={j.id as string} className="flex flex-wrap items-center justify-between rounded-md border p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{typeLabel}</p>
                        {historyLabel && <p className="text-sm truncate">{historyLabel}</p>}
                        <p className="text-muted-foreground text-xs">
                          {new Date(j.created_at as string).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                          {" · "}
                          <span className="uppercase">{j.format as string}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <StatusBadge status={j.status as string} />
                        {j.download_url && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => downloadReport(
                              j.download_url as string,
                              buildReportFilename(
                                j.type as string,
                                j.format as string,
                                (j.filters as Record<string, unknown>) ?? {},
                                interpreterMap,
                              ),
                            ).catch(() => toast({ title: t("common.error"), variant: "destructive" }))}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {j.status === "failed" && j.error_message && (
                        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-1 w-full">
                          {j.error_message as string}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
