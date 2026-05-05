import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppointment, useCancelAppointment, useOfferAppointment } from "../../hooks/useAppointments.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { toast } from "../../hooks/use-toast.js";

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedInterpreters, setSelectedInterpreters] = useState<string[]>([]);

  const { data: appt, isLoading } = useAppointment(id!);
  const cancel = useCancelAppointment(id!);
  const offer = useOfferAppointment(id!);
  const { data: interpreters } = useInterpreters({ limit: "100" });

  if (isLoading) return <LoadingSpinner />;
  if (!appt) return <p>{t("common.not_found")}</p>;

  const a = appt as Record<string, unknown>;

  async function handleCancel() {
    try {
      await cancel.mutateAsync(undefined);
      toast({ title: t("appointments.cancelled") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handleOffer() {
    if (!selectedInterpreters.length) return;
    try {
      await offer.mutateAsync({ interpreter_ids: selectedInterpreters });
      toast({ title: t("appointments.offered") });
      setOfferOpen(false);
      setSelectedInterpreters([]);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("appointments.detail_title")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/appointments/${id}/edit`)}>
              {t("common.edit")}
            </Button>
            {(a.status === "pending_offer" || a.status === "confirmed") && (
              <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
                {t("appointments.cancel")}
              </Button>
            )}
            {a.status === "pending_offer" && (
              <Button onClick={() => setOfferOpen(true)}>{t("appointments.offer_to_interpreters")}</Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("appointments.details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label={t("appointments.status")} value={<StatusBadge status={a.status as string} />} />
            <Field label={t("appointments.date_time")} value={new Date(a.date_time as string).toLocaleString()} />
            <Field label={t("appointments.duration")} value={`${a.duration_minutes} min`} />
            <Field label={t("appointments.language")} value={a.language as string} />
            <Field label={t("appointments.interpreter_type")} value={a.interpreter_type_required as string} />
            {a.po_number && <Field label="PO #" value={a.po_number as string} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("appointments.parties")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label={t("appointments.patient")} value={(a.patient as Record<string, unknown>)?.name as string ?? "—"} />
            <Field label={t("appointments.clinic")} value={(a.clinic as Record<string, unknown>)?.name as string ?? "—"} />
            <Field label={t("appointments.interpreter")} value={(a.interpreter as Record<string, unknown>)?.name as string ?? t("appointments.unassigned")} />
            <Field label={t("appointments.insurance_agency")} value={(a.insurance_agency as Record<string, unknown>)?.name as string ?? "—"} />
            {a.referring_physician && <Field label={t("appointments.referring_physician")} value={a.referring_physician as string} />}
          </CardContent>
        </Card>

        {a.clock_in_time && (
          <Card>
            <CardHeader><CardTitle>{t("appointments.time_tracking")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label={t("appointments.clock_in")} value={new Date(a.clock_in_time as string).toLocaleTimeString()} />
              {a.clock_out_time && <Field label={t("appointments.clock_out")} value={new Date(a.clock_out_time as string).toLocaleTimeString()} />}
              {a.actual_duration_minutes && <Field label={t("appointments.actual_duration")} value={`${a.actual_duration_minutes} min`} />}
              {a.billable_duration_minutes && <Field label={t("appointments.billable_duration")} value={`${a.billable_duration_minutes} min`} />}
            </CardContent>
          </Card>
        )}

        {a.shift_notes && (
          <Card>
            <CardHeader><CardTitle>{t("appointments.shift_notes")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{a.shift_notes as string}</p></CardContent>
          </Card>
        )}
      </div>

      {offerOpen && (
        <Card>
          <CardHeader><CardTitle>{t("appointments.select_interpreters")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {((interpreters?.data ?? []) as Array<Record<string, unknown>>).map((interp) => (
                <label key={interp.id as string} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                  <input
                    type="checkbox"
                    checked={selectedInterpreters.includes(interp.id as string)}
                    onChange={(e) => setSelectedInterpreters(
                      e.target.checked
                        ? [...selectedInterpreters, interp.id as string]
                        : selectedInterpreters.filter((i) => i !== interp.id),
                    )}
                  />
                  <span className="text-sm font-medium">{interp.name as string}</span>
                  <span className="text-sm text-muted-foreground">{interp.type as string}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOffer} disabled={offer.isPending || !selectedInterpreters.length}>
                {t("appointments.send_offers")}
              </Button>
              <Button variant="outline" onClick={() => setOfferOpen(false)}>{t("common.cancel")}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
