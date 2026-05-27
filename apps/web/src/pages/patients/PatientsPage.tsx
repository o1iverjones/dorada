import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePatients, useCreatePatient } from "../../hooks/usePatients.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

export function PatientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferred_language: "" });
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { limit: "50", page: String(page) };
  if (search) params.search = search;

  const { data, isLoading } = usePatients(params);
  const pagination = data?.pagination;

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }
  const create = useCreatePatient();

  async function handleCreate() {
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      const created = await create.mutateAsync(payload) as { id: string };
      toast({ title: t("patients.created") });
      setOpen(false);
      navigate(`/patients/${created.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const columns = [
    { key: "name", header: t("patients.name") },
    {
      key: "date_of_birth",
      header: t("patients.date_of_birth"),
      render: (r: Record<string, unknown>) => {
        const dob = r.date_of_birth as string | null;
        return dob ? new Date(dob).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—";
      },
    },
    {
      key: "claims_case",
      header: t("patients.case_numbers"),
      render: (r: Record<string, unknown>) => {
        const claims = r.claims as Array<{ case_number: string }> | undefined;
        return claims?.length ? claims.map((c) => c.case_number).join(", ") : "—";
      },
    },
    {
      key: "claims_injury",
      header: t("patients.injury"),
      render: (r: Record<string, unknown>) => {
        const claims = r.claims as Array<{ injury: string | null }> | undefined;
        const injuries = claims?.map((c) => c.injury).filter(Boolean) as string[] | undefined;
        return injuries?.length ? injuries.join(", ") : "—";
      },
    },
    {
      key: "preferred_interpreter",
      header: t("patients.preferred_interpreter"),
      render: (r: Record<string, unknown>) => {
        const interp = r.preferred_interpreter as { name: string } | null;
        return interp?.name ?? "—";
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("patients.title")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("patients.new")}
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <PaginationBar page={page} totalPages={pagination?.total_pages} hasMore={!!pagination?.has_more} hasPrev={page > 1} onNext={() => setPage(p => p + 1)} onPrev={() => setPage(p => p - 1)} />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          key={page}
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
          emptyMessage={t("patients.empty")}
        />
      )}

      <PaginationBar page={page} totalPages={pagination?.total_pages} hasMore={!!pagination?.has_more} hasPrev={page > 1} onNext={() => setPage(p => p + 1)} onPrev={() => setPage(p => p - 1)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("patients.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              {([
                { key: "name", label: t("patients.name") },
                { key: "phone", label: t("patients.phone") },
                { key: "email", label: t("patients.email") },
                { key: "preferred_language", label: t("patients.preferred_language") },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input value={form[key]} onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={create.isPending || !form.name}>{t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaginationBar({ page, totalPages, hasMore, hasPrev, onNext, onPrev }: {
  page: number; totalPages?: number; hasMore: boolean; hasPrev: boolean; onNext: () => void; onPrev: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev}>
        <ChevronLeft className="mr-1 h-4 w-4" /> {t("common.previous")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t("common.page")} {page}{totalPages ? ` / ${totalPages}` : ""}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!hasMore}>
        {t("common.next")} <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
