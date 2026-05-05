import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { InterpreterAvatar } from "../../components/shared/InterpreterAvatar.js";
import { Plus } from "lucide-react";

export function InterpretersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useInterpreters({ limit: "100" });

  const columns = [
    {
      key: "avatar",
      header: "",
      render: (row: Record<string, unknown>) => (
        <InterpreterAvatar
          name={row.name as string}
          url={row.profile_picture_url as string | null}
          size="sm"
        />
      ),
    },
    { key: "name", header: t("interpreters.name") },
    { key: "type", header: t("interpreters.type"), render: (row: Record<string, unknown>) => (
      <Badge variant={row.type === "certified" ? "default" : "secondary"}>{row.type as string}</Badge>
    )},
    { key: "phone", header: t("interpreters.phone") },
    { key: "languages", header: t("interpreters.languages"), render: (row: Record<string, unknown>) => {
      const langs = row.languages as string[] ?? [];
      return langs.slice(0, 3).join(", ") + (langs.length > 3 ? ` +${langs.length - 3}` : "");
    }},
    { key: "is_active", header: t("common.status"), render: (row: Record<string, unknown>) => (
      <Badge variant={row.is_active ? "success" : "secondary"}>{row.is_active ? t("common.active") : t("common.inactive")}</Badge>
    )},
  ];

  return (
    <div>
      <PageHeader
        title={t("interpreters.title")}
        actions={
          <Button onClick={() => navigate("/interpreters/new")}>
            <Plus className="mr-2 h-4 w-4" /> {t("interpreters.new")}
          </Button>
        }
      />
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/interpreters/${row.id}`)}
          emptyMessage={t("interpreters.empty")}
        />
      )}
    </div>
  );
}
