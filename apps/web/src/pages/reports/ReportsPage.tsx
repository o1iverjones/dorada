import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateReport, useReportJob, useReportJobs, downloadReport, buildReportFilename, buildReportLabel } from "../../hooks/useReports.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { toast } from "../../hooks/use-toast.js";
import { Download, FileText } from "lucide-react";

const REPORT_TYPES = [
  "interpreter_compensation",
  "insurance_agency_billing",
  "appointment_history",
  "interpreter_performance",
] as const;
type ReportType = typeof REPORT_TYPES[number];

const REPORT_INFO: Record<ReportType, { title: string; description: string }> = {
  interpreter_compensation: { title: "R1 — Interpreter Compensation", description: "Compensation breakdown by interpreter, clinic, and appointment type for a date range" },
  insurance_agency_billing: { title: "R2 — Insurance Agency Billing", description: "Billing reconciliation grouped by insurance agency" },
  appointment_history: { title: "R3 — Appointment History", description: "Full appointment history with optional status filters" },
  interpreter_performance: { title: "R4 — Interpreter Performance", description: "Attendance, on-time rate, and hours worked per interpreter" },
};

export function ReportsPage() {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<ReportType>("interpreter_compensation");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [interpreterIds, setInterpreterIds] = useState<string[]>([]);
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const generate = useGenerateReport();
  const { data: job } = useReportJob(pendingJobId ?? "");
  const { data: jobHistory } = useReportJobs();
  const { data: interpreters } = useInterpreters({ limit: "100" });
  const { data: agencies } = useInsuranceAgencies();

  // id → name lookup used for building download filenames
  const interpreterMap: Record<string, string> = Object.fromEntries(
    ((interpreters?.data ?? []) as Array<{ id: string; name: string }>).map((i) => [i.id, i.name])
  );

  async function handleGenerate() {
    // Clear any previous job display immediately so the status resets before the new job's first poll
    setPendingJobId(null);

    const filters: Record<string, unknown> = { date_from: dateFrom, date_to: dateTo };
    if ((selectedType === "interpreter_compensation" || selectedType === "interpreter_performance") && interpreterIds.length) {
      filters.interpreter_ids = interpreterIds;
    }
    if (selectedType === "insurance_agency_billing" && agencyIds.length) {
      filters.insurance_agency_ids = agencyIds;
    }

    try {
      const result = await generate.mutateAsync({ type: selectedType, format, filters }) as { job_id: string };
      setPendingJobId(result.job_id);
      toast({ title: t("reports.generating") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const jobData = job as Record<string, unknown> | undefined;

  const pendingFilename = jobData
    ? buildReportFilename(
        (jobData.type as string) ?? selectedType,
        (jobData.format as string) ?? format,
        (jobData.filters as Record<string, unknown>) ?? {},
        interpreterMap,
      )
    : "";

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} />

      <div className="grid gap-6 lg:grid-cols-2">
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

            {(selectedType === "interpreter_compensation" || selectedType === "interpreter_performance") && (
              <div className="space-y-1">
                <Label>{t("reports.select_interpreters")}</Label>
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
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
            )}

            {selectedType === "insurance_agency_billing" && (
              <div className="space-y-1">
                <Label>{t("reports.select_agencies")}</Label>
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
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
            )}

            <div className="space-y-1">
              <Label>{t("reports.format")}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "csv")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerate} disabled={generate.isPending || !dateFrom || !dateTo} className="w-full">
              <FileText className="mr-2 h-4 w-4" /> {t("reports.generate")}
            </Button>

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
                    <li key={j.id as string} className="flex items-center justify-between rounded-md border p-3 text-sm">
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
