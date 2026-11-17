import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useClinics, useCreateClinic } from "../../hooks/useClinics.js";
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

const US_STATES: [string, string][] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ["DC","District of Columbia"],
];

export function ClinicsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useClinics({ limit: "300" });
  const create = useCreateClinic();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", zip_code: "", phone: "", contact_name: "", contact_email: "" });
  const [search, setSearch] = useState("");

  const allClinics = (data?.data ?? []) as Array<{ id: string; name: string; address?: string; is_active?: boolean } & Record<string, unknown>>;

  const searchOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const c of allClinics) {
      if (c.name && !seen.has(c.name)) { seen.add(c.name); opts.push({ value: c.name, label: c.name }); }
      if (c.address && !seen.has(c.address)) { seen.add(c.address); opts.push({ value: c.address, label: c.address }); }
    }
    return opts;
  }, [allClinics]);

  const filteredClinics = useMemo(() => {
    if (!search.trim()) return allClinics;
    const q = search.toLowerCase();
    return allClinics.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q)
    );
  }, [allClinics, search]);

  async function handleCreate() {
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        billing: { model: "hourly", hourly_rate: 0, flat_rate: null, invoice_cycle: "monthly" },
      };
      if (form.address) payload.address = form.address;
      if (form.city) payload.city = form.city;
      if (form.state) payload.state = form.state;
      if (form.zip_code) payload.zip_code = form.zip_code;
      if (form.phone) payload.phone = form.phone;
      if (form.contact_name) {
        const contact: Record<string, string> = { name: form.contact_name };
        if (form.contact_email) contact.email = form.contact_email;
        payload.primary_contact = contact;
      }
      const created = await create.mutateAsync(payload) as { id: string };
      toast({ title: t("clinics.created") });
      setOpen(false);
      navigate(`/clinics/${created.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const columns = [
    {
      key: "name",
      header: t("clinics.name"),
      render: (row: typeof allClinics[number]) => (
        <span className="flex items-center gap-2">
          {row.name}
          {row.is_active === false && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#fee2e2", color: "#b91c1c" }}>
              {t("clinics.deactivated")}
            </span>
          )}
        </span>
      ),
    },
    { key: "address", header: t("clinics.address") },
    { key: "phone", header: t("clinics.phone"), render: (row: typeof allClinics[number]) => formatPhone(row.phone as string) },
    { key: "primary_contact_name", header: t("clinics.primary_contact") },
    { key: "primary_contact_email", header: t("clinics.primary_contact_email"), render: (row: typeof allClinics[number]) => (row.primary_contact as Record<string, unknown> | null)?.email as string ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title={t("clinics.title")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("clinics.new")}
          </Button>
        }
      />
      <div className="mb-4 max-w-sm">
        <AutocompleteInput
          options={searchOptions}
          value={search}
          onChange={setSearch}
          placeholder={t("clinics.search")}
          freeText
        />
      </div>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={filteredClinics}
          onRowClick={(row) => navigate(`/clinics/${row.id}`)}
          emptyMessage={t("clinics.empty")}
          rowStyle={(row) => row.is_active === false ? { backgroundColor: "#fef2f2" } : {}}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("clinics.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label>{t("clinics.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("clinics.address")}</Label>
                <Input value={form.address} onChange={(e) => setForm(s => ({ ...s, address: e.target.value }))} placeholder="Street address" />
              </div>
              <div className="space-y-1">
                <Label>{t("clinics.city")}</Label>
                <Input value={form.city} onChange={(e) => setForm(s => ({ ...s, city: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("clinics.state")}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.state}
                    onChange={(e) => setForm(s => ({ ...s, state: e.target.value }))}
                  >
                    <option value="">—</option>
                    {US_STATES.map(([abbr, name]) => (
                      <option key={abbr} value={abbr}>{abbr} — {name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{t("clinics.zip_code")}</Label>
                  <Input value={form.zip_code} onChange={(e) => setForm(s => ({ ...s, zip_code: e.target.value }))} placeholder="00000" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("clinics.phone")}</Label>
                <PhoneInput value={form.phone} onChange={(v) => setForm(s => ({ ...s, phone: v }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("clinics.primary_contact")}</Label>
                <Input value={form.contact_name} onChange={(e) => setForm(s => ({ ...s, contact_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Contact email</Label>
                <Input value={form.contact_email} onChange={(e) => setForm(s => ({ ...s, contact_email: e.target.value }))} />
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
