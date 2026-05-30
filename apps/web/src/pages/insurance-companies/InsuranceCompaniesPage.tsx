import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInsuranceCompanies, useCreateInsuranceCompany } from "../../hooks/useInsuranceCompanies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhone } from "../../lib/phone.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Plus } from "lucide-react";

export function InsuranceCompaniesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useInsuranceCompanies();
  const create = useCreateInsuranceCompany();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [search, setSearch] = useState("");

  const allCompanies = (data?.data ?? []) as Array<{ id: string; name: string; phone?: string | null; email?: string | null; is_active?: boolean } & Record<string, unknown>>;

  const searchOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const c of allCompanies) {
      if (c.name && !seen.has(c.name)) { seen.add(c.name); opts.push({ value: c.name, label: c.name }); }
    }
    return opts;
  }, [allCompanies]);

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return allCompanies;
    const q = search.toLowerCase();
    return allCompanies.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [allCompanies, search]);

  async function handleCreate() {
    try {
      const payload: Record<string, string> = { name: form.name };
      if (form.phone) payload.phone = form.phone;
      if (form.email) payload.email = form.email;
      const created = await create.mutateAsync(payload) as { id: string };
      toast({ title: t("insurance_companies.created") });
      setOpen(false);
      setForm({ name: "", phone: "", email: "" });
      navigate(`/insurance-companies/${created.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const columns = [
    {
      key: "name",
      header: t("insurance_companies.name"),
      render: (row: typeof allCompanies[number]) => (
        <span className="flex items-center gap-2">
          {row.name}
          {row.is_active === false && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#fee2e2", color: "#b91c1c" }}>
              {t("insurance_companies.deactivated")}
            </span>
          )}
        </span>
      ),
    },
    { key: "phone", header: t("insurance_companies.phone"), render: (row: typeof allCompanies[number]) => formatPhone(row.phone) },
    { key: "email", header: t("insurance_companies.email") },
  ];

  return (
    <div>
      <PageHeader
        title={t("insurance_companies.title")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("insurance_companies.new")}
          </Button>
        }
      />
      <div className="mb-4 max-w-sm">
        <AutocompleteInput
          options={searchOptions}
          value={search}
          onChange={setSearch}
          placeholder={t("insurance_companies.search")}
          freeText
        />
      </div>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={filteredCompanies}
          onRowClick={(row) => navigate(`/insurance-companies/${row.id}`)}
          emptyMessage={t("insurance_companies.empty")}
          rowStyle={(row) => row.is_active === false ? { backgroundColor: "#fef2f2" } : {}}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("insurance_companies.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label>{t("insurance_companies.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("insurance_companies.phone")}</Label>
                <PhoneInput value={form.phone} onChange={(v) => setForm(s => ({ ...s, phone: v }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("insurance_companies.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(s => ({ ...s, email: e.target.value }))} />
              </div>
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
