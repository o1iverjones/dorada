import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useClinic, useUpdateClinic } from "../../hooks/useClinics.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";

export function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading } = useClinic(id!);
  const update = useUpdateClinic(id!);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const clinic = data as Record<string, unknown>;

  function startEdit() {
    setForm({ name: clinic.name, address: clinic.address, phone: clinic.phone, primary_contact_name: clinic.primary_contact_name });
    setEditing(true);
  }

  async function save() {
    try {
      await update.mutateAsync(form);
      toast({ title: t("common.saved") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const fields = ["name", "address", "phone", "primary_contact_name", "primary_contact_email"] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={clinic.name as string}
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button onClick={save} disabled={update.isPending}>{t("common.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEdit}>{t("common.edit")}</Button>
          )
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("clinics.details")}</CardTitle></CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f} className="space-y-1">
                  <Label>{t(`clinics.${f}`)}</Label>
                  <Input value={form[f] as string ?? ""} onChange={(e) => setForm(s => ({ ...s, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f}>
                  <p className="text-muted-foreground">{t(`clinics.${f}`)}</p>
                  <p className="font-medium">{clinic[f] as string ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("clinics.billing_config")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t("clinics.billing_model")}</p>
              <p className="font-medium">{(clinic.billing as Record<string, unknown>)?.model as string ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("clinics.billing_rate")}</p>
              <p className="font-medium">{(clinic.billing as Record<string, unknown>)?.rate ? `$${(clinic.billing as Record<string, unknown>).rate}` : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
