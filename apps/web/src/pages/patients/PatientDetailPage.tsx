import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePatient, useUpdatePatient } from "../../hooks/usePatients.js";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Pencil } from "lucide-react";

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data, isLoading } = usePatient(id!);
  const navigate = useNavigate();
  const { data: appts } = useAppointments({ patient_id: id!, limit: "20" });
  const update = useUpdatePatient(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date_of_birth: "", phone: "", email: "", mrn: "", preferred_language: "" });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const p = data as Record<string, unknown>;

  function openEdit() {
    const dob = p.date_of_birth as string | null;
    setForm({
      name: (p.name as string) ?? "",
      date_of_birth: dob ? dob.slice(0, 10) : "",
      phone: (p.phone as string) ?? "",
      email: (p.email as string) ?? "",
      mrn: (p.mrn as string) ?? "",
      preferred_language: (p.preferred_language as string) ?? "",
    });
    setEditOpen(true);
  }

  async function handleSave() {
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      await update.mutateAsync(payload);
      toast({ title: t("common.saved") });
      setEditOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name as string}
        actions={
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("patients.details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              [t("appointments.dob"), p.date_of_birth ? new Date(p.date_of_birth as string).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null],
              [t("patients.phone"), p.phone],
              [t("patients.email"), p.email],
              [t("patients.mrn"), p.mrn],
              [t("patients.preferred_language"), p.preferred_language],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{label as string}</span>
                <span className="font-medium">{value as string ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("patients.appointment_history")}</CardTitle></CardHeader>
          <CardContent>
            {!appts?.data.length ? (
              <p className="text-sm text-muted-foreground">{t("patients.no_appointments")}</p>
            ) : (
              <ul className="space-y-2">
                {(appts.data as Array<Record<string, unknown>>).map((a) => (
                  <li key={a.id as string}>
                    <button
                      onClick={() => navigate(`/appointments/${a.id as string}`)}
                      className="w-full flex items-center justify-between rounded-md border p-3 text-sm text-left hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{formatInTz(a.date_time as string, { dateStyle: "medium", timeStyle: "short" }, tz)}</p>
                        <p className="text-muted-foreground">{(a.clinic as Record<string, unknown>)?.name as string ?? "—"}</p>
                      </div>
                      <StatusBadge status={a.status as string} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <DialogHeader><DialogTitle>{t("patients.edit.title")}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              {([
                { key: "name", label: t("patients.name"), type: "text" },
                { key: "date_of_birth", label: t("appointments.dob"), type: "date" },
                { key: "phone", label: t("patients.phone"), type: "text" },
                { key: "email", label: t("patients.email"), type: "email" },
                { key: "mrn", label: t("patients.mrn"), type: "text" },
                { key: "preferred_language", label: t("patients.preferred_language"), type: "text" },
              ] as const).map(({ key, label, type }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input type={type} value={form[key]} onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={update.isPending || !form.name}>{t("common.save_changes")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
