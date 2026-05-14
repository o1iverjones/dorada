import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFollowUpDrafts, useReviewFollowUpDraft } from "../../hooks/useAppointments.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { toast } from "../../hooks/use-toast.js";

interface FollowUpDraft {
  id: string;
  status: string;
  created_from_appointment: { id: string; date_time: string };
  patient: { id: string; name: string };
  clinic: { id: string; name: string } | null;
  insurance_agency: { id: string; name: string } | null;
  interpreter: { id: string; name: string };
  follow_up_response: {
    same_physician: boolean | null;
    same_clinic: boolean | null;
    follow_up_datetime: string | null;
    notes: string | null;
    media: unknown[];
  };
  created_at: string;
}

export function FollowUpDraftsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useFollowUpDrafts({ status: "pending_review" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner />;

  const drafts = (data?.data ?? []) as FollowUpDraft[];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("appointments.follow_up_drafts_title")}
        description={t("appointments.follow_up_drafts_desc")}
      />
      {!drafts.length ? (
        <p className="text-muted-foreground">{t("appointments.no_follow_up_drafts")}</p>
      ) : (
        drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            expanded={expandedId === draft.id}
            onToggle={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
          />
        ))
      )}
    </div>
  );
}

function DraftCard({ draft, expanded, onToggle }: { draft: FollowUpDraft; expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data: clinics } = useClinics();
  const { data: agencies } = useInsuranceAgencies();
  const review = useReviewFollowUpDraft(draft.id);

  const followUp = draft.follow_up_response;

  const [formState, setFormState] = useState({
    clinic_id: followUp.same_clinic ? (draft.clinic?.id ?? "") : "",
    insurance_agency_id: "",
    date_time: followUp.follow_up_datetime ?? "",
    pre_auth_amount: 0,
    pre_auth_mileage: 0,
  });

  async function handleSchedule() {
    try {
      const payload: Record<string, unknown> = { status: "scheduled", date_time: formState.date_time };
      if (formState.clinic_id) payload.clinic_id = formState.clinic_id;
      if (formState.insurance_agency_id) payload.insurance_agency_id = formState.insurance_agency_id;
      if (formState.pre_auth_amount) payload.pre_auth_amount = formState.pre_auth_amount;
      if (formState.pre_auth_mileage) payload.pre_auth_mileage = formState.pre_auth_mileage;
      await review.mutateAsync(payload);
      toast({ title: t("appointments.follow_up_approved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handleDismiss() {
    try {
      await review.mutateAsync({ status: "dismissed" });
      toast({ title: t("appointments.follow_up_dismissed") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {draft.patient.name}
            {" — "}
            {followUp.follow_up_datetime
              ? formatInTz(followUp.follow_up_datetime, { dateStyle: "medium" }, tz)
              : t("appointments.date_unknown")}
          </CardTitle>
          <Badge variant="warning">{t("appointments.pending_review")}</Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label={t("appointments.patient")} value={draft.patient.name} />
            <Field label={t("appointments.interpreter")} value={draft.interpreter.name} />
            <Field label={t("appointments.same_physician")} value={followUp.same_physician ? t("common.yes") : t("common.no")} />
            <Field label={t("appointments.same_clinic")} value={followUp.same_clinic ? t("common.yes") : t("common.no")} />
            <Field
              label={t("appointments.follow_up_datetime")}
              value={followUp.follow_up_datetime
                ? formatInTz(followUp.follow_up_datetime, { dateStyle: "medium", timeStyle: "short" }, tz)
                : t("appointments.not_provided")}
            />
            <Field label={t("appointments.original_appointment")} value={formatInTz(draft.created_from_appointment.date_time, { dateStyle: "medium" }, tz)} />
          </div>
          {followUp.notes && <p className="text-sm text-muted-foreground italic">{followUp.notes}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">{t("appointments.date_time")}</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formState.date_time ? formState.date_time.slice(0, 16) : ""}
                onChange={(e) => setFormState(s => ({ ...s, date_time: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("appointments.clinic")}</label>
              <select className="mt-1 w-full rounded-md border p-2 text-sm"
                value={formState.clinic_id} onChange={(e) => setFormState(s => ({ ...s, clinic_id: e.target.value }))}>
                <option value="">{draft.clinic ? `${t("appointments.same_as_original")}: ${draft.clinic.name}` : t("appointments.same_as_original")}</option>
                {((clinics?.data ?? []) as Array<{ id: string; name: string }>).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("appointments.insurance_agency")}</label>
              <select className="mt-1 w-full rounded-md border p-2 text-sm"
                value={formState.insurance_agency_id} onChange={(e) => setFormState(s => ({ ...s, insurance_agency_id: e.target.value }))}>
                <option value="">{draft.insurance_agency ? `${t("appointments.same_as_original")}: ${draft.insurance_agency.name}` : t("appointments.same_as_original")}</option>
                {((agencies?.data ?? []) as Array<{ id: string; name: string }>).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSchedule} disabled={review.isPending || !formState.date_time}>
              {t("appointments.approve_and_create")}
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
