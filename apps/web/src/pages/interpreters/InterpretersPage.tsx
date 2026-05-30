import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { InterpreterAvatar } from "../../components/shared/InterpreterAvatar.js";
import { Plus } from "lucide-react";
import { formatPhone } from "../../lib/phone.js";

export function InterpretersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const params: Record<string, string> = { limit: "100" };
  if (search) params.search = search;

  const { data, isLoading } = useInterpreters(params);

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
    { key: "phone", header: t("interpreters.phone"), render: (row: Record<string, unknown>) => formatPhone(row.phone as string) },
    { key: "certificate_number", header: t("interpreters.certificate_number"), render: (row: Record<string, unknown>) => (row.certificate_number as string) || "—" },
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
          onRowClick={(row) => navigate(`/interpreters/${row.id}`)}
          emptyMessage={t("interpreters.empty")}
        />
      )}
    </div>
  );
}
