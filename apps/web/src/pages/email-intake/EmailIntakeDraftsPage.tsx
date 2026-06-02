import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEmailIntakeDrafts, useReviewEmailIntakeDraft } from "../../hooks/useEmailIntake.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useAgencies } from "../../hooks/useAgencies.js";
import { usePatients } from "../../hooks/usePatients.js";
import { useAppointmentTypes } from "../../hooks/useSettings.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";
import { AlertTriangle } from "lucide-react";

export function EmailIntakeDraftsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useEmailIntakeDrafts({ status: "pending_review" });

  if (isLoading) return <LoadingSpinner />;
  const drafts = (data?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <PageHeader title={t("email_intake.drafts_title")} description={t("email_intake.drafts_description")} />
      {!drafts.length ? (
        <p className="text-muted-foreground">{t("email_intake.no_drafts")}</p>
      ) : (
        drafts.map((draft) => <EmailDraftCard key={draft.id as string} draft={draft} />)
      )}
    </div>
  );
}

function EmailDraftCard({ draft }: { draft: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data: clinics } = useClinics();
  const { data: agencies } = useAgencies();
  const { data: patients } = usePatients();
  const { data: types } = useAppointmentTypes();
  const review = useReviewEmailIntakeDraft(draft.id as string);

  const unresolvedFields = draft.unresolved_fields as string[] ?? [];

  const [form, setForm] = useState({
    date_time: draft.extracted_date_time as string ?? "",
    clinic_id: "",
    agency_id: (draft.agency as Record<string, unknown> | null | undefined)?.id as string ?? "",
    patient_id: "",
    type_id: "",
    languages: draft.extracted_languages as string[] ?? [],
    interpreter_type_required: "qualified",
    pre_auth_amount: 0,
    pre_auth_mileage: 0,
    referring_physician: draft.extracted_doctor_name as string ?? "",
  });

  async function handleApprove() {
    try {
      await review.mutateAsync({ status: "approved", ...form });
      toast({ title: t("email_intake.draft_approved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handleDismiss() {
    try {
      await review.mutateAsync({ status: "dismissed" });
      toast({ title: t("email_intake.draft_dismissed") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  function setField(key: string, value: unknown) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {draft.extracted_patient_name as string ?? t("common.unknown")}
            {" — PO: "}
            {draft.po_number as string ?? "—"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {draft.has_unresolved_fields && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t("email_intake.unresolved")}
              </Badge>
            )}
            <Badge variant="warning">{t("common.pending_review")}</Badge>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <ExField label={t("email_intake.extracted_patient")} value={draft.extracted_patient_name as string} unresolved={unresolvedFields.includes("patient_name")} />
            <ExField label={t("email_intake.extracted_clinic")} value={draft.extracted_clinic_name as string} unresolved={unresolvedFields.includes("clinic_name")} />
            <ExField label={t("email_intake.extracted_doctor")} value={draft.extracted_doctor_name as string} unresolved={unresolvedFields.includes("doctor_name")} />
            <ExField label={t("email_intake.extracted_datetime")} value={draft.extracted_date_time as string} unresolved={unresolvedFields.includes("date_time")} />
            <ExField label="PO #" value={draft.po_number as string} unresolved={unresolvedFields.includes("po_number")} />
            <ExField label={t("email_intake.languages")} value={(draft.extracted_languages as string[] ?? []).join(", ")} unresolved={unresolvedFields.includes("languages")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SF label={t("appointments.date_time")} required={unresolvedFields.includes("date_time")}>
              <Input type="datetime-local" value={form.date_time} onChange={(e) => setField("date_time", e.target.value)} />
            </SF>
            <SF label={t("appointments.type")}>
              <select className="w-full rounded-md border p-2 text-sm" value={form.type_id} onChange={(e) => setField("type_id", e.target.value)}>
                <option value="">{t("common.select")}</option>
                {((types?.data ?? []) as Array<{ id: string; name: string }>).map(ty => <option key={ty.id} value={ty.id}>{ty.name}</option>)}
              </select>
            </SF>
            <SF label={t("appointments.patient")} required={unresolvedFields.includes("patient_name")}>
              <select className="w-full rounded-md border p-2 text-sm" value={form.patient_id} onChange={(e) => setField("patient_id", e.target.value)}>
                <option value="">{t("common.select")}</option>
                {((patients?.data ?? []) as Array<{ id: string; name: string }>).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </SF>
            <SF label={t("appointments.clinic")} required={unresolvedFields.includes("clinic_name")}>
              <select className="w-full rounded-md border p-2 text-sm" value={form.clinic_id} onChange={(e) => setField("clinic_id", e.target.value)}>
                <option value="">{t("common.select")}</option>
                {((clinics?.data ?? []) as Array<{ id: string; name: string }>).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </SF>
            <SF label={t("appointments.agency")}>
              <select className="w-full rounded-md border p-2 text-sm" value={form.agency_id} onChange={(e) => setField("agency_id", e.target.value)}>
                <option value="">{t("common.select")}</option>
                {((agencies?.data ?? []) as Array<{ id: string; name: string }>).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </SF>
            <SF label={t("appointments.provider")}>
              <Input value={form.referring_physician} onChange={(e) => setField("referring_physician", e.target.value)} />
            </SF>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApprove} disabled={review.isPending || !form.type_id || !form.clinic_id || !form.patient_id || !form.date_time}>
              {t("email_intake.approve_and_create")}
            </Button>
            <Button variant="outline" onClick={handleDismiss} disabled={review.isPending}>
              {t("common.dismiss")}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ExField({ label, value, unresolved }: { label: string; value: string | null | undefined; unresolved?: boolean }) {
  return (
    <div className={unresolved ? "rounded bg-yellow-50 p-2" : ""}>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">
        {value ?? "—"}
        {unresolved && <span className="ml-2 text-yellow-600 text-xs">(unresolved)</span>}
      </p>
    </div>
  );
}

function SF({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={required ? "text-yellow-700" : ""}>{label}{required && " *"}</Label>
      {children}
    </div>
  );
}
