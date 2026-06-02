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

  const params: Record<string, string> = { limit: "100" };
  if (search) params.search = search;

  const { data, isLoading } = useAgencies(params);

  type AgencyRow = Record<string, unknown> & { email_intake?: { reply_from_email?: string | null; confirmation_method_override?: string | null } | null };

  const columns = [
    { key: "name", header: t("agencies.name") },
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
      <div className="mb-4">
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/agencies/${row.id}`)}
          emptyMessage={t("agencies.empty")}
        />
      )}
    </div>
  );
}
