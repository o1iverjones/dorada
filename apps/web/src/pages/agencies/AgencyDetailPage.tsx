import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAgency, useUpdateAgency, useAgencyActivity, useAgencyNotes, useAddAgencyNote, useUploadAgencyNoteImage } from "../../hooks/useAgencies.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { NoteInput } from "../../components/shared/NoteInput.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhoneInput } from "../../lib/phone.js";
import { PhoneLink } from "../../components/shared/PhoneLink.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { StickyNote, AlertTriangle, ClipboardList } from "lucide-react";

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
  is_active: boolean;
  notes?: string | null;
  contact_method?: string | null;
  telephone?: string | null;
  id_number?: string | null;
  rate_qualified?: number | null;
  rate_certified?: number | null;
  rate_qme?: number | null;
  miles?: number | null;
  reporting_info?: string | null;
  reporting_contact?: string | null;
  followup_info?: string | null;
  followup_contact?: string | null;
  invoice_info?: string | null;
  invoice_contact?: string | null;
  email_intake?: {
    reply_from_email?: string | null;
    reply_from_name?: string | null;
    reply_template?: string | null;
    sender_domains?: string[];
    confirmation_method_override?: string | null;
  } | null;
}

export function AgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data, isLoading } = useAgency(id!);
  const update = useUpdateAgency(id!);
  const { data: activityLog } = useAgencyActivity(id!);
  const { data: adminNotes } = useAgencyNotes(id!);
  const addNote = useAddAgencyNote(id!);
  const uploadNoteImage = useUploadAgencyNoteImage(id!);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [noteText, setNoteText] = useState("");
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const agency = data as AgencyData;
  const isActive = agency.is_active !== false;
  const intake = agency.email_intake;

  function startEdit() {
    setForm({
      name: agency.name ?? "",
      contact_method: agency.contact_method ?? "",
      telephone: formatPhoneInput(agency.telephone ?? ""),
      id_number: agency.id_number ?? "",
      rate_qualified: agency.rate_qualified ?? "",
      rate_certified: agency.rate_certified ?? "",
      rate_qme: agency.rate_qme ?? "",
      miles: agency.miles ?? "",
      reporting_info: agency.reporting_info ?? "",
      reporting_contact: agency.reporting_contact ?? "",
      followup_info: agency.followup_info ?? "",
      followup_contact: agency.followup_contact ?? "",
      invoice_info: agency.invoice_info ?? "",
      invoice_contact: agency.invoice_contact ?? "",
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
        rate_qme: f.rate_qme !== "" && f.rate_qme != null ? Number(f.rate_qme) : null,
        miles: f.miles !== "" && f.miles != null ? Number(f.miles) : null,
        reporting_info: (f.reporting_info as string) || null,
        reporting_contact: (f.reporting_contact as string)?.trim() || null,
        followup_info: (f.followup_info as string) || null,
        followup_contact: (f.followup_contact as string)?.trim() || null,
        invoice_info: (f.invoice_info as string) || null,
        invoice_contact: (f.invoice_contact as string)?.trim() || null,
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
        title={
          <span className="flex items-center gap-3">
            {agency.name}
            {!isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" /> {t("clinics.deactivated")}
              </span>
            )}
          </span>
        }
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
          <CardHeader><CardTitle>{t("agencies.details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("agencies.name")}</Label>
                  <Input value={form.name as string} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.contact_method")}</Label>
                  <Input value={form.contact_method as string} onChange={(e) => set("contact_method", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.telephone")}</Label>
                  <PhoneInput value={form.telephone as string ?? ""} onChange={(v) => set("telephone", v)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.id_number")}</Label>
                  <Input value={form.id_number as string} onChange={(e) => set("id_number", e.target.value)} placeholder={t("common.optional")} />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("agencies.name")} value={agency.name} />
                <Field label={t("agencies.contact_method")} value={agency.contact_method} />
                <Field label={t("agencies.telephone")} value={<PhoneLink phone={agency.telephone} />} />
                <Field label={t("agencies.id_number")} value={agency.id_number} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Rates */}
        <Card>
          <CardHeader><CardTitle>{t("agencies.rates")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("agencies.rate_qualified")}</Label>
                  <Input type="number" step="0.01" min="0" value={form.rate_qualified as string} onChange={(e) => set("rate_qualified", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.rate_certified")}</Label>
                  <Input type="number" step="0.01" min="0" value={form.rate_certified as string} onChange={(e) => set("rate_certified", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.rate_qme")}</Label>
                  <Input type="number" step="0.01" min="0" value={form.rate_qme as string} onChange={(e) => set("rate_qme", e.target.value)} placeholder={t("common.optional")} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.miles")}</Label>
                  <Input type="number" step="0.1" min="0" value={form.miles as string} onChange={(e) => set("miles", e.target.value)} placeholder={t("common.optional")} />
                </div>
              </div>
            ) : (
              <>
                <Field label={t("agencies.rate_qualified")} value={agency.rate_qualified != null ? `$${Number(agency.rate_qualified).toFixed(2)}/hr` : null} />
                <Field label={t("agencies.rate_certified")} value={agency.rate_certified != null ? `$${Number(agency.rate_certified).toFixed(2)}/hr` : null} />
                <Field label={t("agencies.rate_qme")} value={agency.rate_qme != null ? `$${Number(agency.rate_qme).toFixed(2)}/hr` : null} />
                <Field label={t("agencies.miles")} value={agency.miles != null ? `${agency.miles} mi` : null} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Communication preferences */}
        <Card>
          <CardHeader><CardTitle>{t("agencies.communication")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("agencies.reporting_info")}</Label>
                  <ContactSelect value={form.reporting_info as string} onChange={(v) => set("reporting_info", v)} />
                  {(form.reporting_info === "Phone" || form.reporting_info === "Text") && (
                    <Input value={form.reporting_contact as string ?? ""} onChange={(e) => set("reporting_contact", e.target.value)} placeholder="Phone number" />
                  )}
                  {form.reporting_info === "Email" && (
                    <Input type="email" value={form.reporting_contact as string ?? ""} onChange={(e) => set("reporting_contact", e.target.value)} placeholder="Email address" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.followup_info")}</Label>
                  <ContactSelect value={form.followup_info as string} onChange={(v) => set("followup_info", v)} />
                  {(form.followup_info === "Phone" || form.followup_info === "Text") && (
                    <Input value={form.followup_contact as string ?? ""} onChange={(e) => set("followup_contact", e.target.value)} placeholder="Phone number" />
                  )}
                  {form.followup_info === "Email" && (
                    <Input type="email" value={form.followup_contact as string ?? ""} onChange={(e) => set("followup_contact", e.target.value)} placeholder="Email address" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>{t("agencies.invoice_info")}</Label>
                  <ContactSelect value={form.invoice_info as string} onChange={(v) => set("invoice_info", v)} />
                  {(form.invoice_info === "Phone" || form.invoice_info === "Text") && (
                    <Input value={form.invoice_contact as string ?? ""} onChange={(e) => set("invoice_contact", e.target.value)} placeholder="Phone number" />
                  )}
                  {form.invoice_info === "Email" && (
                    <Input type="email" value={form.invoice_contact as string ?? ""} onChange={(e) => set("invoice_contact", e.target.value)} placeholder="Email address" />
                  )}
                </div>
              </div>
            ) : (
              <>
                <Field label={t("agencies.reporting_info")} value={agency.reporting_info ? `${agency.reporting_info}${agency.reporting_contact ? ` — ${agency.reporting_contact}` : ""}` : null} />
                <Field label={t("agencies.followup_info")} value={agency.followup_info ? `${agency.followup_info}${agency.followup_contact ? ` — ${agency.followup_contact}` : ""}` : null} />
                <Field label={t("agencies.invoice_info")} value={agency.invoice_info ? `${agency.invoice_info}${agency.invoice_contact ? ` — ${agency.invoice_contact}` : ""}` : null} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Email intake */}
        <Card>
          <CardHeader><CardTitle>{t("agencies.email_intake")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                {[
                  { key: "reply_from_email", label: t("agencies.reply_from_email") },
                  { key: "reply_from_name", label: t("agencies.reply_from_name") },
                  { key: "sender_domains", label: t("agencies.sender_domains_hint") },
                  { key: "confirmation_method_override", label: t("agencies.confirmation_method") },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input value={form[key] as string ?? ""} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>{t("agencies.reply_template")}</Label>
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
                <Field label={t("agencies.reply_from_email")} value={intake?.reply_from_email} />
                <Field label={t("agencies.reply_from_name")} value={intake?.reply_from_name} />
                <Field label={t("agencies.sender_domains")} value={(intake?.sender_domains ?? []).join(", ") || null} />
                <Field label={t("agencies.confirmation_method")} value={intake?.confirmation_method_override ?? t("common.auto")} />
                {intake?.reply_template && (
                  <div>
                    <p className="text-muted-foreground">{t("agencies.reply_template")}</p>
                    <pre className="mt-1 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{intake.reply_template}</pre>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Admin Notes + Activity Log */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> {t("appointments.admin_notes")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NoteInput
              value={noteText}
              onChange={setNoteText}
              onSave={async (imgUrl) => { await addNote.mutateAsync({ content: noteText.trim(), image_url: imgUrl }); setNoteText(""); }}
              isSaving={addNote.isPending}
              onUploadImage={async (file) => { const res = await uploadNoteImage.mutateAsync(file); return res.url; }}
              placeholder={t("appointments.admin_notes_placeholder")}
              saveLabel={t("common.save")}
            />
            {/* Legacy imported note */}
            {agency.notes && (
              <div className="space-y-1 border-t pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">Imported</span>
                  <span>Nowsta</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{agency.notes}</p>
              </div>
            )}
            {((adminNotes as Array<Record<string, unknown>>) ?? []).length > 0 && (
              <div className="space-y-3 border-t pt-3">
                {(adminNotes as Array<Record<string, unknown>>).map((n) => (
                  <div key={n.id as string} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{n.admin_name as string}</span>
                      <span>·</span>
                      <span>{formatInTz(n.created_at as string, { dateStyle: "medium", timeStyle: "short" }, tz)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{n.content as string}</p>
                    {n.image_url && (
                      <a href={n.image_url as string} target="_blank" rel="noopener noreferrer">
                        <img src={n.image_url as string} alt="note attachment" className="mt-1 max-h-48 w-auto rounded-md border object-cover hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> {t("dashboard.activity_log")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!((activityLog as Array<Record<string, unknown>>) ?? []).length ? (
              <p className="text-sm text-muted-foreground">{t("appointments.no_activity")}</p>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {(activityLog as Array<Record<string, unknown>>).map((entry) => (
                  <li key={entry.id as string} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background border-border" />
                    <p className="text-xs text-muted-foreground">
                      {formatInTz(entry.created_at as string, { dateStyle: "medium", timeStyle: "short" }, tz)}
                      {" · "}
                      <span className="font-medium text-foreground">{entry.admin_name as string}</span>
                    </p>
                    <p className="text-sm mt-0.5 capitalize">
                      {String(entry.action).replace(/_/g, " ")}
                      {entry.detail ? <span className="text-muted-foreground"> — {entry.detail as string}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agency Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={!isActive ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {!isActive && <AlertTriangle className="h-4 w-4 text-red-500" />}
              {t("clinics.status")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isActive ? t("clinics.status_active_description") : t("clinics.status_inactive_description")}
            </p>
            {isActive ? (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors">
                <input type="checkbox" checked={false} onChange={() => setDeactivateDialogOpen(true)} className="h-4 w-4 accent-destructive" />
                <span className="text-sm font-medium text-destructive">{t("clinics.deactivate_label")}</span>
              </label>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 hover:bg-green-100 transition-colors dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-950/50">
                <input type="checkbox" checked={false} onChange={() => setReactivateDialogOpen(true)} className="h-4 w-4 accent-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">{t("clinics.reactivate_label")}</span>
              </label>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t("clinics.deactivate_confirm_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("clinics.deactivate_confirm_body")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ is_active: false });
                  setDeactivateDialogOpen(false);
                  toast({ title: t("clinics.deactivated_toast") });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("clinics.deactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog */}
      <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clinics.reactivate_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("clinics.reactivate_confirm_body")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ is_active: true });
                  setReactivateDialogOpen(false);
                  toast({ title: t("clinics.reactivated") });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("clinics.reactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
