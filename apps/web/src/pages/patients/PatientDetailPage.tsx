import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePatient, useUpdatePatient } from "../../hooks/usePatients.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { Pencil, Plus, X } from "lucide-react";

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data, isLoading } = usePatient(id!);
  const navigate = useNavigate();
  const { data: appts } = useAppointments({ patient_id: id!, limit: "20" });
  const update = useUpdatePatient(id!);
  const { data: interpretersData } = useInterpreters({ limit: "200" });

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date_of_birth: "", phone: "", email: "", preferred_language: "" });
  const [preferredInterpreterId, setPreferredInterpreterId] = useState<string>("");

  // Case number editing state
  const [newCaseNumber, setNewCaseNumber] = useState("");
  const [savingCase, setSavingCase] = useState(false);

  const interpreterOptions = ((interpretersData?.data ?? []) as Array<{ id: string; name: string }>)
    .map((i) => ({ value: i.id, label: i.name }));

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const p = data as Record<string, unknown>;
  const caseNumbers = (p.case_numbers as string[]) ?? [];
  const preferredInterpreter = p.preferred_interpreter as { id: string; name: string } | null | undefined;

  function openEdit() {
    const dob = p.date_of_birth as string | null;
    setForm({
      name: (p.name as string) ?? "",
      date_of_birth: dob ? dob.slice(0, 10) : "",
      phone: (p.phone as string) ?? "",
      email: (p.email as string) ?? "",
      preferred_language: (p.preferred_language as string) ?? "",
    });
    setPreferredInterpreterId(preferredInterpreter?.id ?? "");
    setEditOpen(true);
  }

  async function handleSave() {
    try {
      const payload: Record<string, unknown> = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      payload.preferred_interpreter_id = preferredInterpreterId || null;
      await update.mutateAsync(payload);
      toast({ title: t("common.saved") });
      setEditOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function addCaseNumber() {
    const num = newCaseNumber.trim();
    if (!num || caseNumbers.includes(num)) return;
    setSavingCase(true);
    try {
      await update.mutateAsync({ case_numbers: [...caseNumbers, num] });
      setNewCaseNumber("");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSavingCase(false);
    }
  }

  async function removeCaseNumber(num: string) {
    try {
      await update.mutateAsync({ case_numbers: caseNumbers.filter((n) => n !== num) });
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
        {/* Patient details */}
        <Card>
          <CardHeader><CardTitle>{t("patients.details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              [t("appointments.dob"), p.date_of_birth ? new Date(p.date_of_birth as string).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null],
              [t("patients.phone"), p.phone],
              [t("patients.email"), p.email],
              [t("patients.preferred_language"), p.preferred_language],
              [t("patients.preferred_interpreter"), preferredInterpreter?.name ?? null],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{label as string}</span>
                <span className="font-medium">{(value as string) ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Case numbers */}
        <Card>
          <CardHeader><CardTitle>{t("patients.case_numbers")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {caseNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("patients.no_case_numbers")}</p>
            ) : (
              <ul className="space-y-1.5">
                {caseNumbers.map((num) => (
                  <li key={num} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-mono font-medium">{num}</span>
                    <button
                      type="button"
                      onClick={() => removeCaseNumber(num)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title={t("common.remove")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <Input
                value={newCaseNumber}
                onChange={(e) => setNewCaseNumber(e.target.value)}
                placeholder={t("patients.case_number")}
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCaseNumber(); } }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCaseNumber}
                disabled={!newCaseNumber.trim() || savingCase}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment history */}
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

      {/* Edit dialog */}
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
                { key: "preferred_language", label: t("patients.preferred_language"), type: "text" },
              ] as const).map(({ key, label, type }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input type={type} value={form[key]} onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1">
                <Label>{t("patients.preferred_interpreter")}</Label>
                <AutocompleteInput
                  options={interpreterOptions}
                  value={preferredInterpreterId}
                  onChange={setPreferredInterpreterId}
                  placeholder={t("common.search")}
                />
              </div>
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
