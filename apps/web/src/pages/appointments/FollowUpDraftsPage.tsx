import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFollowUpDrafts, useReviewFollowUpDraft } from "../../hooks/useAppointments.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { useAppointmentTypes } from "../../hooks/useSettings.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Badge } from "../../components/ui/badge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { toast } from "../../hooks/use-toast.js";

export function FollowUpDraftsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useFollowUpDrafts({ status: "pending_review" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner />;

  const drafts = (data?.data ?? []) as Array<Record<string, unknown>>;

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
            key={draft.id as string}
            draft={draft}
            expanded={expandedId === draft.id}
            onToggle={() => setExpandedId(expandedId === draft.id ? null : draft.id as string)}
          />
        ))
      )}
    </div>
  );
}

function DraftCard({ draft, expanded, onToggle }: { draft: Record<string, unknown>; expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const { data: clinics } = useClinics();
  const { data: agencies } = useInsuranceAgencies();
  const { data: types } = useAppointmentTypes();
  const review = useReviewFollowUpDraft(draft.id as string);

  const [formState, setFormState] = useState({
    type_id: "",
    clinic_id: (draft.same_clinic ? (draft.appointment as Record<string, unknown>)?.clinic_id : "") as string ?? "",
    insurance_agency_id: (draft.appointment as Record<string, unknown>)?.insurance_agency_id as string ?? "",
    date_time: draft.follow_up_date_time as string ?? "",
    interpreter_type_required: "qualified",
    pre_auth_amount: 0,
    pre_auth_mileage: 0,
  });

  async function handleApprove() {
    try {
      await review.mutateAsync({ status: "approved", ...formState });
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

  const original = draft.appointment as Record<string, unknown>;

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {(original?.patient as Record<string, unknown>)?.name as string ?? t("common.unknown")}
            {" — "}
            {draft.follow_up_date_time ? new Date(draft.follow_up_date_time as string).toLocaleDateString() : t("appointments.date_unknown")}
          </CardTitle>
          <Badge variant="warning">{t("appointments.pending_review")}</Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label={t("appointments.patient")} value={(original?.patient as Record<string, unknown>)?.name as string} />
            <Field label={t("appointments.same_physician")} value={draft.same_physician ? t("common.yes") : t("common.no")} />
            <Field label={t("appointments.same_clinic")} value={draft.same_clinic ? t("common.yes") : t("common.no")} />
            <Field label={t("appointments.follow_up_datetime")} value={draft.follow_up_date_time as string ?? t("appointments.not_provided")} />
          </div>
          {draft.notes && <p className="text-sm text-muted-foreground">{draft.notes as string}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">{t("appointments.type")}</label>
              <select className="mt-1 w-full rounded-md border p-2 text-sm"
                value={formState.type_id} onChange={(e) => setFormState(s => ({ ...s, type_id: e.target.value }))}>
                <option value="">{t("common.select")}</option>
                {((types?.data ?? []) as Array<{ id: string; name: string }>).map(ty => (
                  <option key={ty.id} value={ty.id}>{ty.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("appointments.clinic")}</label>
              <select className="mt-1 w-full rounded-md border p-2 text-sm"
                value={formState.clinic_id} onChange={(e) => setFormState(s => ({ ...s, clinic_id: e.target.value }))}>
                <option value="">{t("common.select")}</option>
                {((clinics?.data ?? []) as Array<{ id: string; name: string }>).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApprove} disabled={review.isPending || !formState.type_id || !formState.clinic_id}>
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
