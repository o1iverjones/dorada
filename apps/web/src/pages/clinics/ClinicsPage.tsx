import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useClinics, useCreateClinic } from "../../hooks/useClinics.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Plus } from "lucide-react";

export function ClinicsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useClinics();
  const create = useCreateClinic();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", contact_name: "", contact_email: "" });

  async function handleCreate() {
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        billing: { model: "hourly", hourly_rate: null, flat_rate: null, invoice_cycle: "monthly" },
      };
      if (form.address) payload.address = form.address;
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
    { key: "name", header: t("clinics.name") },
    { key: "address", header: t("clinics.address") },
    { key: "phone", header: t("clinics.phone") },
    { key: "primary_contact_name", header: t("clinics.primary_contact") },
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
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns as never}
          data={(data?.data ?? []) as Array<{ id: string } & Record<string, unknown>>}
          onRowClick={(row) => navigate(`/clinics/${row.id}`)}
          emptyMessage={t("clinics.empty")}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <DialogHeader><DialogTitle>{t("clinics.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              {([
                { key: "name", label: t("clinics.name") },
                { key: "address", label: t("clinics.address") },
                { key: "phone", label: t("clinics.phone") },
                { key: "contact_name", label: t("clinics.primary_contact") },
                { key: "contact_email", label: "Contact email" },
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
