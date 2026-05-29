import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Plus } from "lucide-react";

export function InsuranceAgenciesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useInsuranceAgencies();

  type AgencyRow = Record<string, unknown> & { email_intake?: { reply_from_email?: string | null; confirmation_method_override?: string | null } | null };

  const columns = [
    { key: "name", header: t("insurance_agencies.name") },
    { key: "id_number", header: t("insurance_agencies.id_number"), render: (row: AgencyRow) => (row.id_number as string) || "—" },
    { key: "telephone", header: t("insurance_agencies.telephone"), render: (row: AgencyRow) => (row.telephone as string) || "—" },
    { key: "reply_from_email", header: t("insurance_agencies.reply_from_email"), render: (row: AgencyRow) => row.email_intake?.reply_from_email || "—" },
    { key: "confirmation_method", header: t("insurance_agencies.confirmation_method"), render: (row: AgencyRow) => row.email_intake?.confirmation_method_override || t("common.auto") },
  ];

  return (
    <div>
      <PageHeader
        title={t("insurance_agencies.title")}
        actions={
          <Button onClick={() => navigate("/insurance-agencies/new")}>
            <Plus className="mr-2 h-4 w-4" /> {t("insurance_agencies.new")}
          </Button>
        }
      />
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/insurance-agencies/${row.id}`)}
          emptyMessage={t("insurance_agencies.empty")}
        />
      )}
    </div>
  );
}
