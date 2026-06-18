import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useCreateAgency } from "../../hooks/useAgencies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { toast } from "../../hooks/use-toast.js";

const CONTACT_OPTIONS = ["Text", "Phone", "Email", "Link", "Portal", "App"] as const;

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function NewAgencyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateAgency();

  const [form, setForm] = useState({
    name: "",
    telephone: "",
    contact_method: "",
    id_number: "",
    rate_qualified: "",
    rate_certified: "",
    rate_qme: "",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const payload = {
        name: form.name.trim(),
        telephone: form.telephone || undefined,
        contact_method: form.contact_method || undefined,
        id_number: form.id_number || undefined,
        rate_qualified: form.rate_qualified ? Number(form.rate_qualified) : undefined,
        rate_certified: form.rate_certified ? Number(form.rate_certified) : undefined,
        rate_qme: form.rate_qme ? Number(form.rate_qme) : undefined,
        notes: form.notes || undefined,
      };
      const created = await create.mutateAsync(payload) as { id: string };
      toast({ title: t("agencies.new") });
      navigate(`/agencies/${created.id}`);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div>
      <PageHeader title={t("agencies.new")} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <F label={t("agencies.name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </F>
            <F label={t("agencies.telephone")}>
              <PhoneInput value={form.telephone} onChange={(v) => set("telephone", v)} />
            </F>
            <F label={t("agencies.contact_method")}>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.contact_method}
                onChange={(e) => set("contact_method", e.target.value)}
              >
                <option value="">—</option>
                {CONTACT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </F>
            <F label={t("agencies.id_number")}>
              <Input value={form.id_number} onChange={(e) => set("id_number", e.target.value)} />
            </F>
            <F label={t("agencies.rate_qualified")}>
              <Input type="number" step="0.01" min={0} value={form.rate_qualified} onChange={(e) => set("rate_qualified", e.target.value)} />
            </F>
            <F label={t("agencies.rate_certified")}>
              <Input type="number" step="0.01" min={0} value={form.rate_certified} onChange={(e) => set("rate_certified", e.target.value)} />
            </F>
            <F label={t("agencies.rate_qme")}>
              <Input type="number" step="0.01" min={0} value={form.rate_qme} onChange={(e) => set("rate_qme", e.target.value)} />
            </F>
            <F label={t("agencies.notes")}>
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </F>
            <div className="col-span-full flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={!form.name.trim() || create.isPending}>
                {create.isPending ? t("common.saving") : t("common.create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
