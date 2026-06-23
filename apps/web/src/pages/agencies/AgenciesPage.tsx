import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatPhone } from "../../lib/phone.js";
import { useTranslation } from "react-i18next";
import { useAgencies } from "../../hooks/useAgencies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Plus } from "lucide-react";

export function AgenciesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const params: Record<string, string> = { limit: "100" };
  if (search) params.search = search;
  if (showInactive) params.include_inactive = "true";

  const { data, isLoading } = useAgencies(params);

  type AgencyRow = Record<string, unknown> & { is_active?: boolean; email_intake?: { reply_from_email?: string | null; confirmation_method_override?: string | null } | null };

  const columns = [
    {
      key: "name",
      header: t("agencies.name"),
      render: (row: AgencyRow) => (
        <span className="flex items-center gap-2">
          {row.name as string}
          {row.is_active === false && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#fee2e2", color: "#b91c1c" }}>
              {t("agencies.deactivated")}
            </span>
          )}
        </span>
      ),
    },
    { key: "id_number", header: t("agencies.id_number"), render: (row: AgencyRow) => (row.id_number as string) || "—" },
    { key: "telephone", header: t("agencies.telephone"), render: (row: AgencyRow) => formatPhone(row.telephone as string) },
    { key: "reply_from_email", header: t("agencies.reply_from_email"), render: (row: AgencyRow) => row.email_intake?.reply_from_email || "—" },
    { key: "confirmation_method", header: t("agencies.confirmation_method"), render: (row: AgencyRow) => row.email_intake?.confirmation_method_override || t("common.auto") },
  ];

  return (
    <div>
      <PageHeader
        title={t("agencies.title")}
        actions={
          <Button onClick={() => navigate("/agencies/new")}>
            <Plus className="mr-2 h-4 w-4" /> {t("agencies.new")}
          </Button>
        }
      />
      <div className="mb-4 flex items-center gap-4">
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
          <div
            role="switch"
            aria-checked={showInactive}
            onClick={() => setShowInactive((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
              showInactive ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                showInactive ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
          {t("agencies.show_inactive")}
        </label>
      </div>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/agencies/${row.id}`)}
          emptyMessage={t("agencies.empty")}
          rowStyle={(row) => (row as { is_active?: boolean }).is_active === false ? { backgroundColor: "#fef2f2" } : {}}
        />
      )}
    </div>
  );
}
