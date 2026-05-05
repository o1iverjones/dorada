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
import { Plus } from "lucide-react";

export function PatientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", mrn: "", preferred_language: "" });

  const params: Record<string, string> = { limit: "50" };
  if (search) params.search = search;

  const { data, isLoading } = usePatients(params);
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
    { key: "phone", header: t("patients.phone"), render: (r: Record<string, unknown>) => r.phone as string ?? "—" },
    { key: "mrn", header: t("patients.mrn"), render: (r: Record<string, unknown>) => r.mrn as string ?? "—" },
    { key: "preferred_language", header: t("patients.preferred_language"), render: (r: Record<string, unknown>) => r.preferred_language as string ?? "—" },
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
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
          emptyMessage={t("patients.empty")}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("patients.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              {([
                { key: "name", label: t("patients.name") },
                { key: "phone", label: t("patients.phone") },
                { key: "email", label: t("patients.email") },
                { key: "mrn", label: t("patients.mrn") },
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
