import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePatient, useUpdatePatient, useCreateClaim, useUpdateClaim, useDeleteClaim, usePatientActivity, usePatientNotes, useAddPatientNote, useUploadPatientNoteImage } from "../../hooks/usePatients.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useAgencies } from "../../hooks/useAgencies.js";
import { useInsuranceCompanies } from "../../hooks/useInsuranceCompanies.js";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useOrgTimezone, useShowLanguage } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../../components/ui/card.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhoneInput } from "../../lib/phone.js";
import { PhoneLink } from "../../components/shared/PhoneLink.js";
import { Label } from "../../components/ui/label.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { toast } from "../../hooks/use-toast.js";
import { Pencil, Plus, X, ClipboardList, StickyNote } from "lucide-react";
import { NoteInput } from "../../components/shared/NoteInput.js";

interface Claim {
  id: string;
  case_number: string;
  injury: string | null;
  date_of_injury: string | null;
  agency: { id: string; name: string } | null;
  insurance_company: { id: string; name: string } | null;
  adjuster: string | null;
  adjuster_phone: string | null;
  adjuster_email: string | null;
  status: string;
}

const emptyClaimForm = {
  case_number: "",
  injury: "",
  date_of_injury: "",
  agency_id: "",
  insurance_company_id: "",
  adjuster: "",
  adjuster_phone: "",
  adjuster_email: "",
  status: "active",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const showLanguage = useShowLanguage();
  const isMobile = useIsMobile();
  const { data, isLoading } = usePatient(id!);
  const navigate = useNavigate();
  const { data: appts } = useAppointments({ patient_id: id!, limit: "20" });
  const update = useUpdatePatient(id!);
  const { data: interpretersData } = useInterpreters({ limit: "500" });
  const { data: agenciesData } = useAgencies({ limit: "200" });
  const { data: companiesData } = useInsuranceCompanies({ limit: "200" });

  const createClaim = useCreateClaim(id!);
  const deleteClaim = useDeleteClaim(id!);
  const { data: activityLog } = usePatientActivity(id!);
  const { data: adminNotes } = usePatientNotes(id!);
  const addNote = useAddPatientNote(id!);
  const uploadNoteImage = useUploadPatientNoteImage(id!);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", date_of_birth: "", phone: "", email: "", preferred_language: "" });
  const [preferredInterpreterId, setPreferredInterpreterId] = useState<string>("");
  const [noteText, setNoteText] = useState("");

  // Claim dialog state
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [claimForm, setClaimForm] = useState(emptyClaimForm);
  const updateClaim = useUpdateClaim(id!, editingClaimId ?? "");

  const interpreterOptions = ((interpretersData?.data ?? []) as Array<{ id: string; name: string }>)
    .map((i) => ({ value: i.id, label: i.name }));

  const agencyOptions = ((agenciesData?.data ?? []) as Array<{ id: string; name: string }>)
    .map((a) => ({ value: a.id, label: a.name }));
  const companyOptions = ((companiesData?.data ?? []) as Array<{ id: string; name: string }>)
    .map((c) => ({ value: c.id, label: c.name }));

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
      phone: formatPhoneInput((p.phone as string) ?? ""),
      email: (p.email as string) ?? "",
      preferred_language: (p.preferred_language as string) ?? "",
    });
    setPreferredInterpreterId(preferredInterpreter?.id ?? "");
    setEditing(true);
  }

  async function handleSave() {
    try {
      const payload: Record<string, unknown> = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      payload.preferred_interpreter_id = preferredInterpreterId || null;
      await update.mutateAsync(payload);
      toast({ title: t("common.saved") });
      setEditing(false);
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
      agency_id: claim.agency?.id ?? "",
      insurance_company_id: claim.insurance_company?.id ?? "",
      adjuster: claim.adjuster ?? "",
      adjuster_phone: formatPhoneInput(claim.adjuster_phone ?? ""),
      adjuster_email: claim.adjuster_email ?? "",
      status: claim.status ?? "active",
    });
    setClaimDialogOpen(true);
  }

  async function handleClaimSave() {
    try {
      const payload: Record<string, unknown> = {
        case_number: claimForm.case_number,
        injury: claimForm.injury || null,
        date_of_injury: claimForm.date_of_injury || null,
        agency_id: claimForm.agency_id || null,
        insurance_company_id: claimForm.insurance_company_id || null,
        adjuster: claimForm.adjuster || null,
        adjuster_phone: claimForm.adjuster_phone || null,
        adjuster_email: claimForm.adjuster_email || null,
        status: claimForm.status,
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

  // Shared edit fields used in both inline (desktop) and dialog (mobile)
  const editFields = (
    <div className="space-y-3">
      {([
        { key: "name", label: t("patients.name"), type: "text" },
        { key: "date_of_birth", label: t("appointments.dob"), type: "date" },
        { key: "email", label: t("patients.email"), type: "email" },
        ...(showLanguage ? [{ key: "preferred_language" as const, label: t("patients.preferred_language"), type: "text" }] : []),
      ] as const).map(({ key, label, type }) => (
        <div key={key} className="space-y-1">
          <Label>{label}</Label>
          <Input type={type} value={form[key]} onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))} />
        </div>
      ))}
      <div className="space-y-1">
        <Label>{t("patients.phone")}</Label>
        <PhoneInput value={form.phone} onChange={(v) => setForm(s => ({ ...s, phone: v }))} />
      </div>
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
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name as string}
        actions={
          !editing ? (
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}
            </Button>
          ) : (
            // Desktop: show Save/Cancel in the card footer; hide header buttons
            <span className="hidden" />
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient details */}
        <Card>
          <CardHeader><CardTitle>{t("patients.details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {/* Desktop inline edit — only shown when editing on md+ */}
            {editing && !isMobile ? (
              editFields
            ) : (
              [
                [t("appointments.dob"), p.date_of_birth ? new Date(p.date_of_birth as string).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null],
                [t("patients.phone"), p.phone ? "__phone__" : null],
                [t("patients.email"), p.email],
                ...(showLanguage ? [[t("patients.preferred_language"), p.preferred_language]] : []),
                [t("patients.preferred_interpreter"), preferredInterpreter?.name ?? null],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className="font-medium">
                    {value === "__phone__"
                      ? <PhoneLink phone={p.phone as string} />
                      : ((value as string) ?? "—")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
          {/* Desktop Save / Cancel buttons */}
          {editing && !isMobile && (
            <CardFooter className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSave} disabled={update.isPending || !form.name}>{t("common.save_changes")}</Button>
            </CardFooter>
          )}
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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold">{claim.case_number}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${claim.status === "closed" ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-800"}`}>
                          {t(`patients.claim_status_${claim.status}`, { defaultValue: claim.status })}
                        </span>
                      </div>
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
                    {claim.insurance_company && (
                      <div className="text-muted-foreground">{t("patients.insurance_company")}: <span className="text-foreground">{claim.insurance_company.name}</span></div>
                    )}
                    {claim.agency && (
                      <div className="text-muted-foreground">{t("patients.agency")}: <span className="text-foreground">{claim.agency.name}</span></div>
                    )}
                    {claim.adjuster && (
                      <div className="text-muted-foreground">{t("patients.adjuster")}: <span className="text-foreground">{claim.adjuster}</span></div>
                    )}
                    {claim.adjuster_phone && (
                      <div className="text-muted-foreground">{t("patients.adjuster_phone")}: <span className="text-foreground"><PhoneLink phone={claim.adjuster_phone} /></span></div>
                    )}
                    {claim.adjuster_email && (
                      <div className="text-muted-foreground">{t("patients.adjuster_email")}: <span className="text-foreground">{claim.adjuster_email}</span></div>
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
        <CardContent className="p-0">
          {!appts?.data.length ? (
            <p className="text-sm text-muted-foreground px-6 py-4">{t("patients.no_appointments")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-medium">{t("appointments.date_time")}</th>
                    <th className="px-4 py-2 text-left font-medium">{t("appointments.agency")}</th>
                    <th className="px-4 py-2 text-left font-medium">{t("appointments.referring_physician")}</th>
                    <th className="px-4 py-2 text-left font-medium">{t("appointments.status")}</th>
                    <th className="px-4 py-2 text-left font-medium">{t("appointments.interpreter")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(appts.data as Array<Record<string, unknown>>).slice().reverse().map((a) => (
                    <tr
                      key={a.id as string}
                      onClick={() => navigate(`/appointments/${a.id as string}`)}
                      className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                        {formatInTz(a.date_time as string, { dateStyle: "medium", timeStyle: "short" }, tz)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {(a.agency as Record<string, unknown>)?.name as string ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.referring_physician as string ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.status as string} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {(a.interpreter as Record<string, unknown>)?.name as string ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
            {p.notes && (
              <div className="space-y-1 border-t pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">Imported</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{p.notes as string}</p>
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

      {/* Edit patient — Dialog on mobile only */}
      <Dialog open={editing && isMobile} onOpenChange={(open) => { if (!open) setEditing(false); }}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <DialogHeader><DialogTitle>{t("patients.edit.title")}</DialogTitle></DialogHeader>
            <div className="py-4">{editFields}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={update.isPending || !form.name}>{t("common.save_changes")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit claim dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="flex flex-col max-h-[90vh]">
          <form onSubmit={(e) => { e.preventDefault(); handleClaimSave(); }} className="flex flex-col min-h-0 flex-1">
            <DialogHeader>
              <DialogTitle>{editingClaimId ? t("patients.edit_claim") : t("patients.add_claim")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <Label>{t("patients.claim_status")}</Label>
                <Select value={claimForm.status} onValueChange={(v) => setClaimForm(s => ({ ...s, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("patients.claim_status_active")}</SelectItem>
                    <SelectItem value="closed">{t("patients.claim_status_closed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <Label>{t("patients.insurance_company")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <AutocompleteInput
                  options={companyOptions}
                  value={claimForm.insurance_company_id}
                  onChange={(val) => setClaimForm(s => ({ ...s, insurance_company_id: val }))}
                  placeholder={t("common.search")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("patients.agency")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <AutocompleteInput
                  options={agencyOptions}
                  value={claimForm.agency_id}
                  onChange={(val) => setClaimForm(s => ({ ...s, agency_id: val }))}
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
              <div className="space-y-1">
                <Label>{t("patients.adjuster_phone")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <PhoneInput
                  value={claimForm.adjuster_phone ?? ""}
                  onChange={(v) => setClaimForm(s => ({ ...s, adjuster_phone: v }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("patients.adjuster_email")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input
                  type="email"
                  value={claimForm.adjuster_email}
                  onChange={(e) => setClaimForm(s => ({ ...s, adjuster_email: e.target.value }))}
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
