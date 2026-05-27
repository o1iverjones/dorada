import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePatient, useUpdatePatient, useCreateClaim, useUpdateClaim, useDeleteClaim } from "../../hooks/usePatients.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
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

interface Claim {
  id: string;
  case_number: string;
  injury: string | null;
  date_of_injury: string | null;
  insurance_agency: { id: string; name: string } | null;
  adjuster: string | null;
}

const emptyClaimForm = {
  case_number: "",
  injury: "",
  date_of_injury: "",
  insurance_agency_id: "",
  adjuster: "",
};

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data, isLoading } = usePatient(id!);
  const navigate = useNavigate();
  const { data: appts } = useAppointments({ patient_id: id!, limit: "20" });
  const update = useUpdatePatient(id!);
  const { data: interpretersData } = useInterpreters({ limit: "200" });
  const { data: agenciesData } = useInsuranceAgencies({ limit: "200" });

  const createClaim = useCreateClaim(id!);
  const deleteClaim = useDeleteClaim(id!);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date_of_birth: "", phone: "", email: "", preferred_language: "" });
  const [preferredInterpreterId, setPreferredInterpreterId] = useState<string>("");

  // Claim dialog state
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [claimForm, setClaimForm] = useState(emptyClaimForm);
  const updateClaim = useUpdateClaim(id!, editingClaimId ?? "");

  const interpreterOptions = ((interpretersData?.data ?? []) as Array<{ id: string; name: string }>)
    .map((i) => ({ value: i.id, label: i.name }));

  const agencyOptions = ((agenciesData?.data ?? []) as Array<{ id: string; name: string }>)
    .map((a) => ({ value: a.id, label: a.name }));

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const p = data as Record<string, unknown>;
  const claims = (p.claims as Claim[]) ?? [];
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

  function openAddClaim() {
    setEditingClaimId(null);
    setClaimForm(emptyClaimForm);
    setClaimDialogOpen(true);
  }

  function openEditClaim(claim: Claim) {
    setEditingClaimId(claim.id);
    setClaimForm({
      case_number: claim.case_number,
      injury: claim.injury ?? "",
      date_of_injury: claim.date_of_injury ? claim.date_of_injury.slice(0, 10) : "",
      insurance_agency_id: claim.insurance_agency?.id ?? "",
      adjuster: claim.adjuster ?? "",
    });
    setClaimDialogOpen(true);
  }

  async function handleClaimSave() {
    try {
      const payload: Record<string, unknown> = {
        case_number: claimForm.case_number,
        injury: claimForm.injury || null,
        date_of_injury: claimForm.date_of_injury || null,
        insurance_agency_id: claimForm.insurance_agency_id || null,
        adjuster: claimForm.adjuster || null,
      };
      if (editingClaimId) {
        await updateClaim.mutateAsync(payload);
      } else {
        await createClaim.mutateAsync(payload);
      }
      toast({ title: t("common.saved") });
      setClaimDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handleDeleteClaim(claimId: string) {
    try {
      await deleteClaim.mutateAsync(claimId);
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

        {/* Claims */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>{t("patients.claims")}</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={openAddClaim}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {t("patients.add_claim")}
            </Button>
          </CardHeader>
          <CardContent>
            {claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("patients.no_claims")}</p>
            ) : (
              <ul className="space-y-2">
                {claims.map((claim) => (
                  <li key={claim.id} className="rounded-md border p-3 text-sm space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono font-semibold">{claim.case_number}</span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditClaim(claim)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={t("common.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClaim(claim.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title={t("common.remove")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {claim.injury && (
                      <div className="text-muted-foreground">{t("patients.injury")}: <span className="text-foreground">{claim.injury}</span></div>
                    )}
                    {claim.date_of_injury && (
                      <div className="text-muted-foreground">{t("patients.date_of_injury")}: <span className="text-foreground">{new Date(claim.date_of_injury).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</span></div>
                    )}
                    {claim.insurance_agency && (
                      <div className="text-muted-foreground">{t("patients.insurance_agency")}: <span className="text-foreground">{claim.insurance_agency.name}</span></div>
                    )}
                    {claim.adjuster && (
                      <div className="text-muted-foreground">{t("patients.adjuster")}: <span className="text-foreground">{claim.adjuster}</span></div>
                    )}
                  </li>
                ))}
              </ul>
            )}
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

      {/* Edit patient dialog */}
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

      {/* Add / Edit claim dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleClaimSave(); }}>
            <DialogHeader>
              <DialogTitle>{editingClaimId ? t("patients.edit_claim") : t("patients.add_claim")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label>{t("patients.case_number")}</Label>
                <Input
                  value={claimForm.case_number}
                  onChange={(e) => setClaimForm(s => ({ ...s, case_number: e.target.value }))}
                  placeholder="e.g. CLM-00123"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("patients.injury")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input
                  value={claimForm.injury}
                  onChange={(e) => setClaimForm(s => ({ ...s, injury: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("patients.date_of_injury")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input
                  type="date"
                  value={claimForm.date_of_injury}
                  onChange={(e) => setClaimForm(s => ({ ...s, date_of_injury: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("patients.insurance_agency")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <AutocompleteInput
                  options={agencyOptions}
                  value={claimForm.insurance_agency_id}
                  onChange={(val) => setClaimForm(s => ({ ...s, insurance_agency_id: val }))}
                  placeholder={t("common.search")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("patients.adjuster")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input
                  value={claimForm.adjuster}
                  onChange={(e) => setClaimForm(s => ({ ...s, adjuster: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClaimDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button
                type="submit"
                disabled={!claimForm.case_number.trim() || createClaim.isPending || updateClaim.isPending}
              >
                {editingClaimId ? t("common.save_changes") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
