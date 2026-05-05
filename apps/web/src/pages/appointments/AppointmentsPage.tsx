import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppointments } from "../../hooks/useAppointments.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Plus, Search } from "lucide-react";

export function AppointmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");

  const params: Record<string, string> = { limit: "50" };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useAppointments(params);

  const STATUSES = ["pending_offer", "confirmed", "in_progress", "completed", "cancelled"];

  const columns = [
    { key: "date_time", header: t("appointments.date_time"), render: (row: Record<string, unknown>) => new Date(row.date_time as string).toLocaleString() },
    { key: "patient_name", header: t("appointments.patient") },
    { key: "clinic_name", header: t("appointments.clinic") },
    { key: "interpreter_name", header: t("appointments.interpreter"), render: (row: Record<string, unknown>) => (row.interpreter_name as string) ?? "—" },
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

      <div className="mb-4 flex gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("")}>
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
