import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInsuranceAgency, useUpdateInsuranceAgency } from "../../hooks/useInsuranceAgencies.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";

export function InsuranceAgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading } = useInsuranceAgency(id!);
  const update = useUpdateInsuranceAgency(id!);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const agency = data as Record<string, unknown>;

  function startEdit() {
    setForm({
      name: agency.name,
      reply_from_email: agency.reply_from_email,
      reply_from_name: agency.reply_from_name,
      reply_template: agency.reply_template,
      confirmation_method_override: agency.confirmation_method_override ?? "",
      sender_domains: (agency.sender_domains as string[] ?? []).join(", "),
    });
    setEditing(true);
  }

  async function save() {
    try {
      const payload = {
        ...form,
        sender_domains: (form.sender_domains as string).split(",").map((s) => s.trim()).filter(Boolean),
      };
      await update.mutateAsync(payload);
      toast({ title: t("common.saved") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={agency.name as string}
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
        <CardHeader><CardTitle>{t("insurance_agencies.details")}</CardTitle></CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              {[
                { key: "name", label: t("insurance_agencies.name") },
                { key: "reply_from_email", label: t("insurance_agencies.reply_from_email") },
                { key: "reply_from_name", label: t("insurance_agencies.reply_from_name") },
                { key: "sender_domains", label: t("insurance_agencies.sender_domains_hint") },
                { key: "confirmation_method_override", label: t("insurance_agencies.confirmation_method") },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input value={form[key] as string ?? ""} onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label>{t("insurance_agencies.reply_template")}</Label>
                <textarea
                  className="w-full rounded-md border p-2 text-sm"
                  rows={6}
                  value={form.reply_template as string ?? ""}
                  onChange={(e) => setForm(s => ({ ...s, reply_template: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {[
                ["insurance_agencies.name", agency.name],
                ["insurance_agencies.reply_from_email", agency.reply_from_email],
                ["insurance_agencies.reply_from_name", agency.reply_from_name],
                ["insurance_agencies.sender_domains", (agency.sender_domains as string[] ?? []).join(", ")],
                ["insurance_agencies.confirmation_method", agency.confirmation_method_override ?? t("common.auto")],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t(label as string)}</span>
                  <span className="text-right font-medium">{value as string ?? "—"}</span>
                </div>
              ))}
              {agency.reply_template && (
                <div>
                  <p className="text-muted-foreground">{t("insurance_agencies.reply_template")}</p>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{agency.reply_template as string}</pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
