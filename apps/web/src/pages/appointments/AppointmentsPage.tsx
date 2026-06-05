import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useOrgTimezone, useShowLanguage } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { Plus, TriangleAlert, Clock, UserRound } from "lucide-react";

const NOT_COMPLETED = "unassigned,pending_offer,confirmed,in_progress,cancelled,declined";

export function AppointmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const showLanguage = useShowLanguage();
  const [searchParams] = useSearchParams();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  const [dateFilter, setDateFilter] = useState(searchParams.get("date_from") ?? "");
  const [interpreterFilter, setInterpreterFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");

  const params: Record<string, string> = { limit: "100" };
  if (statusFilter === "not_completed") params.status = NOT_COMPLETED;
  else if (statusFilter !== "all") params.status = statusFilter;
  if (dateFilter) { params.date_from = dateFilter; params.date_to = dateFilter; }
  else { params.date_from = todayStr; }
  if (interpreterFilter) params.interpreter_id = interpreterFilter;
  if (clinicFilter !== "all") params.clinic_id = clinicFilter;

  const { data, isLoading } = useAppointments(params);
  const { data: interpretersData } = useInterpreters({ limit: "500" });
  const { data: clinicsData } = useClinics({ limit: "200" });

  const interpreterOptions = ((interpretersData?.data ?? []) as Array<{ id: string; name: string }>).map((i) => ({
    value: i.id,
    label: i.name,
  }));
  const clinicOptions = ((clinicsData?.data ?? []) as Array<{ id: string; name: string }>).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const hasFilters = !!(dateFilter || interpreterFilter || clinicFilter !== "all" || statusFilter !== "all");

  const columns = [
    {
      key: "date_time",
      header: t("appointments.date_time"),
      className: "w-32",
      render: (row: Record<string, unknown>) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium leading-tight">{formatInTz(row.date_time as string, { dateStyle: "medium" }, tz)}</span>
          <span className="text-xs text-muted-foreground">{formatInTz(row.date_time as string, { timeStyle: "short" }, tz)}</span>
        </div>
      ),
    },
    {
      key: "patient_po",
      header: "Patient & PO",
      className: "w-44",
      render: (row: Record<string, unknown>) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold leading-tight">{(row.patient as Record<string, unknown>)?.name as string ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{(row.po_number as string) ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "clinic_agency",
      header: "Clinic & Agency",
      className: "w-56",
      render: (row: Record<string, unknown>) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium leading-tight">{(row.clinic as Record<string, unknown>)?.name as string ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{(row.agency as Record<string, unknown>)?.name as string ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "interpreter",
      header: t("appointments.interpreter"),
      className: "w-36",
      render: (row: Record<string, unknown>) => {
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
      },
    },
    ...(showLanguage ? [{ key: "language", header: t("appointments.language"), className: "w-24" }] : []),
    {
      key: "status",
      header: t("common.status"),
      className: "w-20",
      render: (row: Record<string, unknown>) => <StatusBadge status={row.status as string} />,
    },
    {
      key: "time_tracking",
      header: t("appointments.time_tracking"),
      className: "w-36",
      render: (row: Record<string, unknown>) => {
        const fmt = (iso: unknown) => iso ? formatInTz(iso as string, { timeStyle: "short" }, tz) : null;
        const clockIn = fmt(row.clock_in_time);
        const arrived = fmt(row.patient_arrived_at);
        const clockOut = fmt(row.clock_out_time);
        if (!clockIn && !arrived && !clockOut) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-col gap-0.5 text-xs">
            {(clockIn || clockOut) && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{clockIn ?? "—"}</span>
                <span className="text-muted-foreground">–</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{clockOut ?? "—"}</span>
              </span>
            )}
            {arrived && (
              <span className="flex items-center gap-1">
                <UserRound className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{arrived}</span>
              </span>
            )}
          </div>
        );
      },
    },
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
        {/* Date picker */}
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-40"
          title={t("appointments.date_time")}
        />

        {/* Interpreter filter */}
        <div className="w-52">
          <AutocompleteInput
            options={interpreterOptions}
            value={interpreterFilter}
            onChange={setInterpreterFilter}
            placeholder={t("appointments.filter_interpreter")}
          />
        </div>

        {/* Clinic filter */}
        <div className="w-52">
          <AutocompleteInput
            options={clinicOptions}
            value={clinicFilter === "all" ? "" : clinicFilter}
            onChange={(v) => setClinicFilter(v || "all")}
            placeholder={t("appointments.clinic")}
          />
        </div>

        {/* Status dropdown */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_completed">{t("appointments.not_completed")}</SelectItem>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="unassigned">{t("calendar.status_unassigned")}</SelectItem>
            <SelectItem value="pending_offer">{t("calendar.status_pending_offer")}</SelectItem>
            <SelectItem value="confirmed">{t("calendar.status_confirmed")}</SelectItem>
            <SelectItem value="in_progress">{t("calendar.status_in_progress")}</SelectItem>
            <SelectItem value="completed">{t("calendar.status_completed")}</SelectItem>
            <SelectItem value="cancelled">{t("calendar.status_cancelled")}</SelectItem>
            <SelectItem value="declined">{t("calendar.status_declined")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setDateFilter(""); setInterpreterFilter(""); setClinicFilter("all"); setStatusFilter("all"); }}
          className={hasFilters
            ? "border-green-600 text-green-700 bg-green-50 hover:bg-green-100"
            : "opacity-40 cursor-default"}
        >
          {t("common.clear")}
        </Button>
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
