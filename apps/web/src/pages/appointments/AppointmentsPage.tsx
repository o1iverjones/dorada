import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Plus, Search, TriangleAlert } from "lucide-react";

export function AppointmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "not_completed");
  // dateFrom: open-ended "from this date onwards" (no date_to); dateExact: single-day filter (date_from = date_to)
  const initialDateFrom = searchParams.get("date_from") && !searchParams.get("date_to") ? searchParams.get("date_from")! : "";
  const initialDateExact = searchParams.get("date_from") && searchParams.get("date_to") ? searchParams.get("date_from")! : "";
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateFilter, setDateFilter] = useState(initialDateExact);

  const NOT_COMPLETED = "pending_offer,confirmed,in_progress,cancelled";
  const params: Record<string, string> = { limit: "50" };
  if (statusFilter === "not_completed") params.status = NOT_COMPLETED;
  else if (statusFilter) params.status = statusFilter;
  if (dateFilter) { params.date_from = dateFilter; params.date_to = dateFilter; }
  else if (dateFrom) { params.date_from = dateFrom; }

  const { data, isLoading } = useAppointments(params);

  const STATUSES = ["pending_offer", "confirmed", "in_progress", "completed", "cancelled"];

  const columns = [
    { key: "date_time", header: t("appointments.date_time"), render: (row: Record<string, unknown>) => formatInTz(row.date_time as string, { dateStyle: "medium", timeStyle: "short" }, tz) },
    { key: "patient", header: t("appointments.patient"), render: (row: Record<string, unknown>) => (row.patient as Record<string, unknown>)?.name as string ?? "—" },
    { key: "clinic", header: t("appointments.clinic"), render: (row: Record<string, unknown>) => (row.clinic as Record<string, unknown>)?.name as string ?? "—" },
    { key: "interpreter", header: t("appointments.interpreter"), render: (row: Record<string, unknown>) => {
      const assigned = (row.interpreter as Record<string, unknown> | null)?.name as string | undefined;
      if (assigned) return assigned;
      const offers = (row.offers as Array<{ interpreter: { name: string } }>) ?? [];
      if (offers.length === 0) return (
        <span className="flex items-center gap-1.5 text-amber-600">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>{t("appointments.no_offer")}</span>
        </span>
      );
      if (offers.length === 1) return offers[0].interpreter.name;
      return t("common.multiple");
    }},
    { key: "insurance_agency", header: t("appointments.insurance_agency"), render: (row: Record<string, unknown>) => (row.insurance_agency as Record<string, unknown>)?.name as string ?? "—" },
    { key: "po_number", header: t("appointments.po_number"), render: (row: Record<string, unknown>) => (row.po_number as string) ?? "—" },
    { key: "language", header: t("appointments.language") },
    { key: "status", header: t("common.status"), render: (row: Record<string, unknown>) => <StatusBadge status={row.status as string} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t("appointments.title")}
        actions={
          <Button onClick={() => navigate("/appointments/new")}>
            <Plus className="mr-2 h-4 w-4" /> {t("appointments.new")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {dateFrom && (
          <div className="flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-sm">
            <span className="text-muted-foreground">From: <span className="font-medium text-foreground">{dateFrom}</span></span>
            <button onClick={() => setDateFrom("")} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        {dateFilter && (
          <div className="flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-sm">
            <span className="text-muted-foreground">Date: <span className="font-medium text-foreground">{dateFilter}</span></span>
            <button onClick={() => setDateFilter("")} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant={statusFilter === "not_completed" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("not_completed")}>
            {t("appointments.not_completed")}
          </Button>
          <Button variant={statusFilter === "" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("")}>
            {t("common.all")}
          </Button>
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/appointments/${row.id}`)}
          emptyMessage={t("appointments.empty")}
        />
      )}
    </div>
  );
}
