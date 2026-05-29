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

const CONTACT_OPTIONS = ["Text", "Phone", "Email", "Link", "Portal", "App"] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function ContactSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {CONTACT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

interface AgencyData {
  id: string;
  name: string;
  notes?: string | null;
  contact_method?: string | null;
  telephone?: string | null;
  id_number?: string | null;
  rate_qualified?: number | null;
  rate_certified?: number | null;
  miles?: number | null;
  reporting_info?: string | null;
  followup_info?: string | null;
  invoice_info?: string | null;
  email_intake?: {
    reply_from_email?: string | null;
    reply_from_name?: string | null;
    reply_template?: string | null;
    sender_domains?: string[];
    confirmation_method_override?: string | null;
  } | null;
}

export function InsuranceAgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading } = useInsuranceAgency(id!);
  const update = useUpdateInsuranceAgency(id!);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const agency = data as AgencyData;
  const intake = agency.email_intake;

  function startEdit() {
    setForm({
      name: agency.name ?? "",
      contact_method: agency.contact_method ?? "",
      telephone: agency.telephone ?? "",
      id_number: agency.id_number ?? "",
      rate_qualified: agency.rate_qualified ?? "",
      rate_certified: agency.rate_certified ?? "",
      miles: agency.miles ?? "",
      reporting_info: agency.reporting_info ?? "",
      followup_info: agency.followup_info ?? "",
      invoice_info: agency.invoice_info ?? "",
      notes: agency.notes ?? "",
      // email_intake fields — sourced from the nested object
      reply_from_email: intake?.reply_from_email ?? "",
      reply_from_name: intake?.reply_from_name ?? "",
      reply_template: intake?.reply_template ?? "",
      confirmation_method_override: intake?.confirmation_method_override ?? "",
      sender_domains: (intake?.sender_domains ?? []).join(", "),
    });
    setEditing(true);
  }

  async function save() {
    try {
      const f = form;
      const senderDomains = (f.sender_domains as string).split(",").map((s) => s.trim()).filter(Boolean);
      const hasEmailIntake = !!(
        (f.reply_from_email as string)?.trim() ||
        (f.reply_from_name as string)?.trim() ||
        senderDomains.length
      );

      const payload: Record<string, unknown> = {
        name: f.name,
        contact_method: (f.contact_method as string) || null,
        telephone: (f.telephone as string)?.trim() || null,
        id_number: (f.id_number as string)?.trim() || null,
        rate_qualified: f.rate_qualified !== "" && f.rate_qualified != null ? Number(f.rate_qualified) : null,
        rate_certified: f.rate_certified !== "" && f.rate_certified != null ? Number(f.rate_certified) : null,
        miles: f.miles !== "" && f.miles != null ? Number(f.miles) : null,
        reporting_info: (f.reporting_info as string) || null,
        followup_info: (f.followup_info as string) || null,
        invoice_info: (f.invoice_info as string) || null,
        notes: (f.notes as string)?.trim() || null,
        // email_intake is a nested object in the API schema
        email_intake: hasEmailIntake ? {
          sender_domains: senderDomains,
          confirmation_method_override: (f.confirmation_method_override as string) || null,
          reply_template: (f.reply_template as string) || "",
          reply_from_name: (f.reply_from_name as string) || "",
          reply_from_email: (f.reply_from_email as string) || "",
        } : undefined,
      };
      await update.mutateAsync(payload);
      toast({ title: t("common.saved") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const set = (k: string, v: unknown) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={agency.name}
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

      <div className="grid gap-6 lg:grid-cols-2">

        {/* General info */}
        <Card>
          <CardHeader><CardTitle>{t("insurance_agencies.details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.name")}</Label>
                  <Input value={form.name as string} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.contact_method")}</Label>
                  <Input value={form.contact_method as string} onChange={(e) => set("contact_method", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.telephone")}</Label>
                  <Input value={form.telephone as string} onChange={(e) => set("telephone", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.id_number")}</Label>
                  <Input value={form.id_number as string} onChange={(e) => set("id_number", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.notes")}</Label>
                  <textarea
                    className="w-full rounded-md border p-2 text-sm"
                    rows={3}
                    value={form.notes as string}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("insurance_agencies.name")} value={agency.name} />
                <Field label={t("insurance_agencies.contact_method")} value={agency.contact_method} />
                <Field label={t("insurance_agencies.telephone")} value={agency.telephone} />
                <Field label={t("insurance_agencies.id_number")} value={agency.id_number} />
                {agency.notes && (
                  <div>
                    <p className="text-muted-foreground mb-1">{t("insurance_agencies.notes")}</p>
                    <p className="font-medium">{agency.notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Rates */}
        <Card>
          <CardHeader><CardTitle>{t("insurance_agencies.rates")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.rate_qualified")}</Label>
                  <Input type="number" step="0.01" min="0" value={form.rate_qualified as string} onChange={(e) => set("rate_qualified", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.rate_certified")}</Label>
                  <Input type="number" step="0.01" min="0" value={form.rate_certified as string} onChange={(e) => set("rate_certified", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.miles")}</Label>
                  <Input type="number" step="0.1" min="0" value={form.miles as string} onChange={(e) => set("miles", e.target.value)} placeholder={t("common.optional")} />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("insurance_agencies.rate_qualified")} value={agency.rate_qualified != null ? `$${Number(agency.rate_qualified).toFixed(2)}/hr` : null} />
                <Field label={t("insurance_agencies.rate_certified")} value={agency.rate_certified != null ? `$${Number(agency.rate_certified).toFixed(2)}/hr` : null} />
                <Field label={t("insurance_agencies.miles")} value={agency.miles != null ? `${agency.miles} mi` : null} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Communication preferences */}
        <Card>
          <CardHeader><CardTitle>{t("insurance_agencies.communication")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.reporting_info")}</Label>
                  <ContactSelect value={form.reporting_info as string} onChange={(v) => set("reporting_info", v)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.followup_info")}</Label>
                  <ContactSelect value={form.followup_info as string} onChange={(v) => set("followup_info", v)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.invoice_info")}</Label>
                  <ContactSelect value={form.invoice_info as string} onChange={(v) => set("invoice_info", v)} />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("insurance_agencies.reporting_info")} value={agency.reporting_info} />
                <Field label={t("insurance_agencies.followup_info")} value={agency.followup_info} />
                <Field label={t("insurance_agencies.invoice_info")} value={agency.invoice_info} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Email intake */}
        <Card>
          <CardHeader><CardTitle>{t("insurance_agencies.email_intake")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                {[
                  { key: "reply_from_email", label: t("insurance_agencies.reply_from_email") },
                  { key: "reply_from_name", label: t("insurance_agencies.reply_from_name") },
                  { key: "sender_domains", label: t("insurance_agencies.sender_domains_hint") },
                  { key: "confirmation_method_override", label: t("insurance_agencies.confirmation_method") },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input value={form[key] as string ?? ""} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>{t("insurance_agencies.reply_template")}</Label>
                  <textarea
                    className="w-full rounded-md border p-2 text-sm"
                    rows={5}
                    value={form.reply_template as string ?? ""}
                    onChange={(e) => set("reply_template", e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("insurance_agencies.reply_from_email")} value={intake?.reply_from_email} />
                <Field label={t("insurance_agencies.reply_from_name")} value={intake?.reply_from_name} />
                <Field label={t("insurance_agencies.sender_domains")} value={(intake?.sender_domains ?? []).join(", ") || null} />
                <Field label={t("insurance_agencies.confirmation_method")} value={intake?.confirmation_method_override ?? t("common.auto")} />
                {intake?.reply_template && (
                  <div>
                    <p className="text-muted-foreground">{t("insurance_agencies.reply_template")}</p>
                    <pre className="mt-1 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{intake.reply_template}</pre>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
