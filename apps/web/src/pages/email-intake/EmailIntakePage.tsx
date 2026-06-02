import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEmailIntakeLogs, useRetryConfirmation } from "../../hooks/useEmailIntake.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";
import { toast } from "../../hooks/use-toast.js";
import { RefreshCw } from "lucide-react";

export function EmailIntakePage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("");
  const params: Record<string, string> = { limit: "50" };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useEmailIntakeLogs(params);
  const STATUSES = ["unprocessed", "processing", "processed", "flagged", "failed"];

  const columns = [
    { key: "received_at", header: t("email_intake.received_at"), render: (r: Record<string, unknown>) => new Date(r.received_at as string).toLocaleString() },
    { key: "from_email", header: t("email_intake.from") },
    { key: "subject", header: t("email_intake.subject") },
    { key: "agency", header: t("email_intake.agency"), render: (r: Record<string, unknown>) => (r.agency as Record<string, unknown>)?.name as string ?? "—" },
    { key: "status", header: t("common.status"), render: (r: Record<string, unknown>) => <StatusBadge status={r.status as string} /> },
    { key: "confirmation_status", header: t("email_intake.confirmation"), render: (r: Record<string, unknown>) => r.confirmation_status ? <StatusBadge status={r.confirmation_status as string} /> : <span className="text-muted-foreground">—</span> },
    { key: "has_unresolved_fields", header: "", render: (r: Record<string, unknown>) => r.has_unresolved_fields ? <Badge variant="warning">{t("email_intake.unresolved")}</Badge> : null },
    { key: "duplicate_po", header: "", render: (r: Record<string, unknown>) => r.duplicate_po ? <Badge variant="destructive">Duplicate PO</Badge> : null },
  ];

  return (
    <div>
      <PageHeader title={t("email_intake.logs_title")} description={t("email_intake.logs_description")} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("")}>{t("common.all")}</Button>
        {STATUSES.map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          emptyMessage={t("email_intake.no_logs")}
        />
      )}
    </div>
  );
}
