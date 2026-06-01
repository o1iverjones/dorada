import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSocket } from "../../lib/socket.js";
import { useAppointment, useCancelAppointment, useOfferAppointment, useUpdateAppointment, useAppointmentActivity, useAppointmentNotes, useAddAppointmentNote, usePatchClockTimes, useAppointmentMedia, useManualConfirm, useUnassignInterpreter } from "../../hooks/useAppointments.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useClinic, useClinics, useClinicDoctors } from "../../hooks/useClinics.js";
import { useInsuranceAgencies } from "../../hooks/useInsuranceAgencies.js";
import { usePatients, useUpdatePatient } from "../../hooks/usePatients.js";
import { useOrgTimezone, useSystemSettings, useInterpreterRates, useShowLanguage } from "../../hooks/useSettings.js";
import { formatInTz, toTzDateTimeInput, fromTzDateTimeInput } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { NoteInput } from "../../components/shared/NoteInput.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { MapPin, ParkingCircle, ExternalLink, ClipboardList, StickyNote, Copy, Pencil, FileCheck, Images, AlertTriangle, UserX } from "lucide-react";
import { DateTimePicker } from "../../components/ui/date-time-picker.js";
import { DurationInput } from "../../components/shared/DurationInput.js";

const LANGUAGES = ["Spanish", "French", "Tagalog", "Russian", "Mandarin"];

type FormState = {
  date_time: string;
  duration_minutes: number;
  type_id: string;
  language: string;
  interpreter_type_required: "certified" | "qualified";
  clinic_id: string;
  insurance_agency_id: string;
  patient_id: string;
  referring_physician: string;
  po_number: string;
  pre_auth_amount: number;
  pre_auth_mileage: number;
  dob: string; // "YYYY-MM-DD" or ""
};

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const showLanguage = useShowLanguage();
  const { data: settingsData } = useSystemSettings();
  const allowManualConfirm = (settingsData as Record<string, unknown>)?.allow_manual_confirm as boolean ?? false;
  const [selectedInterpreters, setSelectedInterpreters] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({} as FormState);
  const [noteText, setNoteText] = useState("");
  const [editingClockIn, setEditingClockIn] = useState(false);
  const [editingPatientArrived, setEditingPatientArrived] = useState(false);
  const [editingClockOut, setEditingClockOut] = useState(false);
  const [clockInForm, setClockInForm] = useState("");
  const [patientArrivedForm, setPatientArrivedForm] = useState("");
  const [clockOutForm, setClockOutForm] = useState("");
  const [confirmUnassign, setConfirmUnassign] = useState(false);

  const { data: appt, isLoading, refetch } = useAppointment(id!);

  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { appointmentId: string }) => {
      if (data.appointmentId === id) refetch();
    };
    socket.on("appointment:offer_updated", handler);
    return () => { socket.off("appointment:offer_updated", handler); };
  }, [id, refetch]);

  const cancel = useCancelAppointment(id!);
  const offer = useOfferAppointment(id!);
  const update = useUpdateAppointment(id!);
  const patchClock = usePatchClockTimes(id!);
  const patientId = ((appt as Record<string, unknown>)?.patient as Record<string, unknown> | null | undefined)?.id as string | undefined;
  const updatePatient = useUpdatePatient(patientId ?? "");
  const { data: activityLog } = useAppointmentActivity(id!);
  const { data: adminNotes } = useAppointmentNotes(id!);
  const addNote = useAddAppointmentNote(id!);
  const { data: mediaData } = useAppointmentMedia(id!);
  const manualConfirm = useManualConfirm(id!);
  const unassign = useUnassignInterpreter(id!);

  // Lookup data for edit mode
  const { data: clinicsData } = useClinics({ limit: "500" });
  const { data: agenciesData } = useInsuranceAgencies({ limit: "500" });
  const { data: patientsData } = usePatients({ limit: "500" });
  const { data: settings } = useSystemSettings();
  const { data: ratesData } = useInterpreterRates();

  const clinicOptions = ((clinicsData?.data ?? []) as Array<{ id: string; name: string }>).map((c) => ({ value: c.id, label: c.name }));
  const agencyOptions = ((agenciesData?.data ?? []) as Array<{ id: string; name: string }>).map((a) => ({ value: a.id, label: a.name }));
  const patientOptions = ((patientsData?.data ?? []) as Array<{ id: string; name: string }>).map((p) => ({ value: p.id, label: p.name }));
  const apptTypes = ((settings as Record<string, unknown> | undefined)?.appointment_types ?? []) as Array<{ id: string; name: string }>;
  const certQualTypes = apptTypes.filter((ty) => ty.name === "Certified" || ty.name === "Qualified");
  const interpreterRates = ratesData?.data ?? [];

  const a = appt as Record<string, unknown> | undefined;
  const isCertified = a?.interpreter_type_required === "certified";
  const apptDateTime = a?.date_time as string | undefined;

  const { data: interpreters } = useInterpreters({
    limit: "100",
    ...(isCertified ? { type: "certified" } : {}),
    ...(apptDateTime ? { check_availability_on: apptDateTime } : {}),
  });

  const clinicId = (a?.clinic as Record<string, unknown>)?.id as string | undefined;
  // In edit mode, track which clinic is selected so provider list updates immediately
  const editClinicId = editing ? form.clinic_id : (clinicId ?? "");
  const { data: clinicDoctors } = useClinicDoctors(editClinicId);
  const providerOptions = ((clinicDoctors ?? []) as Array<{ id: string; name: string }>)
    .map((d) => ({ value: d.name, label: d.name }));
  const { data: clinicData } = useClinic(clinicId ?? "");
  const excludedFromClinic = new Set(
    ((clinicData as Record<string, unknown>)?.interpreters_not_allowed as Array<{ id: string }> ?? []).map((i) => i.id),
  );

  const clinicRaw = clinicData as Record<string, unknown> | undefined;
  const clinicCityRaw = (clinicRaw?.city as string | null | undefined)?.trim()
    || extractCityFromAddress(clinicRaw?.address as string | null | undefined);
  const clinicCity = clinicCityRaw?.toLowerCase() ?? null;
  const clinicCityDisplay = clinicCityRaw ?? null;
  const allInterpreterList = (interpreters?.data ?? []) as Array<Record<string, unknown>>;
  const cityMatchedInterpreters = clinicCity
    ? allInterpreterList.filter((i) =>
        ((i.preferred_cities as string[] | undefined) ?? []).some(
          (c) => c.trim().toLowerCase() === clinicCity,
        ),
      )
    : allInterpreterList;
  // Fall back to all interpreters if none match the clinic city
  const interpretersForOffer = cityMatchedInterpreters.length > 0 ? cityMatchedInterpreters : allInterpreterList;
  const cityFilterApplied = clinicCity !== null && cityMatchedInterpreters.length > 0;
  const cityFilterNoMatch = clinicCity !== null && cityMatchedInterpreters.length === 0;

  if (isLoading) return <LoadingSpinner />;
  if (!appt || !a) return <p>{t("common.not_found")}</p>;

  function startEdit() {
    setForm({
      date_time: toTzDateTimeInput(a!.date_time as string, tz),
      duration_minutes: a!.duration_minutes as number,
      type_id: (a!.type as Record<string, unknown>)?.id as string ?? "",
      language: a!.language as string ?? "",
      interpreter_type_required: a!.interpreter_type_required as "certified" | "qualified",
      clinic_id: (a!.clinic as Record<string, unknown>)?.id as string ?? "",
      insurance_agency_id: (a!.insurance_agency as Record<string, unknown>)?.id as string ?? "",
      patient_id: (a!.patient as Record<string, unknown>)?.id as string ?? "",
      referring_physician: a!.referring_physician as string ?? "",
      po_number: a!.po_number as string ?? "",
      pre_auth_amount: Number(a!.pre_auth_amount ?? 0),
      pre_auth_mileage: Number(a!.pre_auth_mileage ?? 0),
      dob: ((a!.patient as Record<string, unknown>)?.date_of_birth as string | null)?.slice(0, 10) ?? "",
    });
    setEditing(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    try {
      await Promise.all([
        update.mutateAsync({
          date_time: fromTzDateTimeInput(form.date_time, tz),
          duration_minutes: form.duration_minutes,
          ...(form.type_id ? { type_id: form.type_id } : {}),
          language: form.language,
          interpreter_type_required: form.interpreter_type_required,
          ...(form.clinic_id ? { clinic_id: form.clinic_id } : {}),
          ...(form.insurance_agency_id ? { insurance_agency_id: form.insurance_agency_id } : {}),
          ...(form.patient_id ? { patient_id: form.patient_id } : {}),
          referring_physician: form.referring_physician || undefined,
          po_number: form.po_number || undefined,
          pre_auth_amount: form.pre_auth_amount,
          pre_auth_mileage: Math.round(form.pre_auth_mileage),
        }),
        patientId
          ? updatePatient.mutateAsync({ date_of_birth: form.dob || null })
          : Promise.resolve(),
      ]);
      toast({ title: t("appointments.updated") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

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
      setSelectedInterpreters([]);
    } catch (err) {
      const message = (err instanceof Error && err.message) ? err.message : t("common.error");
      const code = (err as Record<string, unknown>)?.code as string | undefined;
      toast({ title: message, description: code ?? undefined, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("appointments.detail_title")}
        actions={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={save} disabled={update.isPending}>{t("common.save")}</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEdit}>{t("common.edit")}</Button>
                <Button variant="outline" onClick={() => navigate("/appointments/new", {
                  state: {
                    prefill: {
                      duration_minutes: a.duration_minutes,
                      type_id: a.type_id,
                      language: a.language,
                      interpreter_type_required: a.interpreter_type_required,
                      clinic_id: (a.clinic as Record<string, unknown>)?.id,
                      insurance_agency_id: (a.insurance_agency as Record<string, unknown>)?.id,
                      patient_id: (a.patient as Record<string, unknown>)?.id,
                      referring_physician: a.referring_physician,
                      pre_auth_amount: a.pre_auth_amount,
                      pre_auth_mileage: a.pre_auth_mileage,
                      po_number: a.po_number,
                    },
                  },
                })}>
                  <Copy className="h-4 w-4 mr-1.5" />{t("appointments.duplicate")}
                </Button>
                {(a.status === "pending_offer" || a.status === "confirmed") && (
                  <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
                    {t("appointments.cancel")}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("appointments.details")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm p-0 pb-2">

            {/* Patient */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.patient")}>
                  <AutocompleteInput options={patientOptions} value={form.patient_id} onChange={(v) => set("patient_id", v)} placeholder={t("common.search")} />
                </InlineRow>
              ) : (
                <Field label={t("appointments.patient")} value={
                  <button onClick={() => navigate(`/patients/${(a.patient as Record<string, unknown>)?.id as string}`)} className="font-bold text-primary hover:underline">
                    {(a.patient as Record<string, unknown>)?.name as string ?? "—"}
                  </button>
                } />
              )}
            </div>

            {/* Interpreter */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing && (a.interpreter as Record<string, unknown>)?.name ? (
                <InlineRow label={t("appointments.interpreter")}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {(a.interpreter as Record<string, unknown>)?.name as string}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-destructive border-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmUnassign(true)}
                    >
                      <UserX className="h-3.5 w-3.5 mr-1" />
                      {t("appointments.unassign")}
                    </Button>
                  </div>
                </InlineRow>
              ) : (
                <Field label={t("appointments.interpreter")} value={
                  <span className="font-bold">
                    {(a.interpreter as Record<string, unknown>)?.name as string ?? t("appointments.unassigned")}
                  </span>
                } />
              )}
            </div>

            {/* PO Number */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.po_number")}>
                  <Input className="h-7 text-sm" value={form.po_number} onChange={(e) => set("po_number", e.target.value)} placeholder="—" />
                </InlineRow>
              ) : (
                <Field label={t("appointments.po_number")} value={(a.po_number as string) ?? "—"} />
              )}
            </div>

            {/* DOB */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.dob")}>
                  <Input
                    type="date"
                    className="h-7 text-sm"
                    value={form.dob}
                    onChange={(e) => set("dob", e.target.value)}
                  />
                </InlineRow>
              ) : (
                <Field label={t("appointments.dob")} value={
                  (a.patient as Record<string, unknown>)?.date_of_birth
                    ? new Date((a.patient as Record<string, unknown>).date_of_birth as string).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
                    : "—"
                } />
              )}
            </div>

            {/* Status — always read-only */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              <Field label={t("appointments.status")} value={<StatusBadge status={a.status as string} />} />
            </div>

            {/* Date/Time */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.date_time")}>
                  <DateTimePicker value={form.date_time} onChange={(v) => set("date_time", v)} />
                </InlineRow>
              ) : (
                <Field label={t("appointments.date_time")} value={formatInTz(a.date_time as string, { dateStyle: "medium", timeStyle: "short" }, tz)} />
              )}
            </div>

            {/* Duration */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.duration")}>
                  <DurationInput value={form.duration_minutes} onChange={(mins) => set("duration_minutes", mins)} className="h-7 text-sm" />
                </InlineRow>
              ) : (
                <Field label={t("appointments.duration")} value={`${a.duration_minutes} min`} />
              )}
            </div>

            {/* Language */}
            {showLanguage && (
              <div className="px-6 py-2.5 even:bg-muted/40">
                {editing ? (
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground">{t("appointments.language")}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGES.map((lang) => (
                        <button key={lang} type="button" onClick={() => set("language", lang)}
                          className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${form.language === lang ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}>
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Field label={t("appointments.language")} value={a.language as string} />
                )}
              </div>
            )}

            {/* Interpreter Type */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <div className="space-y-1.5">
                  <span className="text-muted-foreground">{t("appointments.type")}</span>
                  <div className="flex gap-2">
                    {certQualTypes.map((ty) => (
                      <button key={ty.id} type="button" onClick={() => { set("type_id", ty.id); set("interpreter_type_required", ty.name.toLowerCase() as "certified" | "qualified"); }}
                        className={`rounded-full border px-3 py-0.5 text-xs transition-colors ${form.type_id === ty.id ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}>
                        {ty.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Field label={t("appointments.interpreter_type")} value={a.interpreter_type_required as string} />
              )}
            </div>

            {/* Clinic */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.clinic")}>
                  <AutocompleteInput options={clinicOptions} value={form.clinic_id} onChange={(v) => { set("clinic_id", v); set("referring_physician", ""); }} placeholder={t("common.search")} />
                </InlineRow>
              ) : (
                <Field label={t("appointments.clinic")} value={(a.clinic as Record<string, unknown>)?.name as string ?? "—"} />
              )}
            </div>

            {/* Insurance Agency */}
            <div className="px-6 py-2.5 even:bg-muted/40">
              {editing ? (
                <InlineRow label={t("appointments.insurance_agency")}>
                  <AutocompleteInput options={agencyOptions} value={form.insurance_agency_id} onChange={(v) => set("insurance_agency_id", v)} placeholder={t("common.search")} />
                </InlineRow>
              ) : (
                <Field label={t("appointments.insurance_agency")} value={(a.insurance_agency as Record<string, unknown>)?.name as string ?? "—"} />
              )}
            </div>

            {/* Provider */}
            {(editing || a.referring_physician) && (
              <div className="px-6 py-2.5 even:bg-muted/40">
                {editing ? (
                  <InlineRow label={t("appointments.provider")}>
                    <AutocompleteInput options={providerOptions} value={form.referring_physician} onChange={(v) => set("referring_physician", v)} placeholder={t("common.search")} freeText />
                  </InlineRow>
                ) : (
                  <Field label={t("appointments.provider")} value={a.referring_physician as string} />
                )}
              </div>
            )}

            {/* Pre-auth rate */}
            {editing && (
              <div className="px-6 py-2.5 even:bg-muted/40">
                <InlineRow label={t("settings.interpreter_rates")}>
                  <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={form.pre_auth_amount}
                    onChange={(e) => set("pre_auth_amount", parseFloat(e.target.value) || 0)}
                  >
                    <option value="">{t("common.select")}</option>
                    {interpreterRates.map((r) => (
                      <option key={r.id} value={r.amount}>{r.title} — ${r.amount.toFixed(2)}</option>
                    ))}
                  </select>
                </InlineRow>
              </div>
            )}

            {/* Pre-auth mileage */}
            {editing && (
              <div className="px-6 py-2.5 even:bg-muted/40">
                <InlineRow label={t("appointments.pre_auth_mileage")}>
                  <Input type="number" step="0.1" min={0} className="h-7 text-sm" value={form.pre_auth_mileage} onChange={(e) => set("pre_auth_mileage", Number(e.target.value))} />
                </InlineRow>
              </div>
            )}

          </CardContent>
        </Card>

        <LocationCard clinic={a.clinic as Record<string, unknown>} physician={a.referring_physician as string | null} />

        {a.shift_notes && (
          <Card>
            <CardHeader><CardTitle>{t("appointments.shift_notes")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{a.shift_notes as string}</p></CardContent>
          </Card>
        )}
      </div>

      {(() => {
        const invoice = a.invoice as Record<string, unknown> | null | undefined;
        if (!invoice) return null;
        return (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <p className="font-semibold text-orange-900">{t("invoices.invoice_submitted")}</p>
                  <p className="text-sm text-orange-700">
                    ${Number(invoice.amount).toFixed(2)} · {t(`invoices.status_${invoice.status as string}`)} · {formatInTz(invoice.submitted_at as string, { dateStyle: "medium" }, tz)}
                  </p>
                </div>
              </div>
              <Button variant="outline" className="shrink-0 border-orange-300 bg-white text-orange-800 hover:bg-orange-100" onClick={() => navigate("/invoices")}>
                {t("invoices.review_and_approve")}
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {((a.offers as Array<Record<string, unknown>>) ?? []).filter((o) => o.status === "pending").length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("appointments.pending_offers")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {((a.offers as Array<Record<string, unknown>>) ?? [])
              .filter((o) => o.status === "pending")
              .map((o) => (
                <div key={o.id as string} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-medium">{(o.interpreter as Record<string, unknown>)?.name as string}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{t("appointments.offer_pending")}</span>
                    {allowManualConfirm && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                          disabled={manualConfirm.isPending}
                          onChange={() => {
                            manualConfirm.mutate((o.interpreter as Record<string, unknown>)?.id as string, {
                              onSuccess: () => toast({ title: t("appointments.manually_confirmed") }),
                              onError: () => toast({ title: t("common.error"), variant: "destructive" }),
                            });
                          }}
                        />
                        {t("appointments.manually_confirm")}
                      </label>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {(a.status === "pending_offer" || a.status === "declined") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("appointments.select_interpreters")}</CardTitle>
            {cityFilterApplied && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("appointments.city_filter_active").replace("{{city}}", clinicCityDisplay ?? "")}
              </p>
            )}
            {cityFilterNoMatch && (
              <p className="text-xs text-amber-600 mt-1">
                {t("appointments.city_filter_no_match").replace("{{city}}", clinicCityDisplay ?? "")}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <InterpreterSearch
              interpreters={interpretersForOffer}
              offers={(a.offers as Array<Record<string, unknown>>) ?? []}
              excludedFromClinic={excludedFromClinic}
              selectedInterpreters={selectedInterpreters}
              setSelectedInterpreters={setSelectedInterpreters}
              t={t}
            />
            <Button onClick={handleOffer} disabled={offer.isPending || !selectedInterpreters.length}>
              {t("appointments.offer_to_interpreters")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("appointments.time_tracking")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* Clock in row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("appointments.clock_in")}</span>
              {editingClockIn ? (
                <div className="flex gap-2">
                  <Button size="sm" disabled={patchClock.isPending} onClick={async () => {
                    try {
                      await patchClock.mutateAsync({ clock_in_time: clockInForm ? fromTzDateTimeInput(clockInForm, tz) : undefined });
                      await refetch();
                      toast({ title: t("common.saved") });
                      setEditingClockIn(false);
                    } catch {
                      toast({ title: t("common.error"), variant: "destructive" });
                    }
                  }}>{t("common.save")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingClockIn(false)}>{t("common.cancel")}</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  setClockInForm(toTzDateTimeInput(new Date().toISOString(), tz));
                  setEditingClockIn(true);
                }}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />{t("common.edit")}
                </Button>
              )}
            </div>
            {editingClockIn ? (
              <DateTimePicker value={clockInForm} onChange={setClockInForm} />
            ) : (
              <span className="font-medium">{a.clock_in_time ? formatInTz(a.clock_in_time as string, { dateStyle: "medium", timeStyle: "short" }, tz) : "—"}</span>
            )}
          </div>

          <div className="border-t" />

          {/* Patient arrived row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("appointments.patient_arrived")}</span>
              {editingPatientArrived ? (
                <div className="flex gap-2">
                  <Button size="sm" disabled={patchClock.isPending} onClick={async () => {
                    try {
                      await patchClock.mutateAsync({ patient_arrived_at: patientArrivedForm ? fromTzDateTimeInput(patientArrivedForm, tz) : undefined });
                      await refetch();
                      toast({ title: t("common.saved") });
                      setEditingPatientArrived(false);
                    } catch {
                      toast({ title: t("common.error"), variant: "destructive" });
                    }
                  }}>{t("common.save")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingPatientArrived(false)}>{t("common.cancel")}</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  setPatientArrivedForm(toTzDateTimeInput(new Date().toISOString(), tz));
                  setEditingPatientArrived(true);
                }}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />{t("common.edit")}
                </Button>
              )}
            </div>
            {editingPatientArrived ? (
              <DateTimePicker value={patientArrivedForm} onChange={setPatientArrivedForm} />
            ) : (
              <span className="font-medium">{a.patient_arrived_at ? formatInTz(a.patient_arrived_at as string, { dateStyle: "medium", timeStyle: "short" }, tz) : "—"}</span>
            )}
          </div>

          <div className="border-t" />

          {/* Clock out row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("appointments.clock_out")}</span>
              {editingClockOut ? (
                <div className="flex gap-2">
                  <Button size="sm" disabled={patchClock.isPending} onClick={async () => {
                    try {
                      await patchClock.mutateAsync({ clock_out_time: clockOutForm ? fromTzDateTimeInput(clockOutForm, tz) : undefined });
                      await refetch();
                      toast({ title: t("common.saved") });
                      setEditingClockOut(false);
                    } catch {
                      toast({ title: t("common.error"), variant: "destructive" });
                    }
                  }}>{t("common.save")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingClockOut(false)}>{t("common.cancel")}</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  setClockOutForm(toTzDateTimeInput(new Date().toISOString(), tz));
                  setEditingClockOut(true);
                }}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />{t("common.edit")}
                </Button>
              )}
            </div>
            {editingClockOut ? (
              <DateTimePicker value={clockOutForm} onChange={setClockOutForm} />
            ) : (
              <span className="font-medium">{a.clock_out_time ? formatInTz(a.clock_out_time as string, { dateStyle: "medium", timeStyle: "short" }, tz) : "—"}</span>
            )}
          </div>

          {a.clock_in_lat != null && (
            <>
              <div className="border-t" />
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">{t("appointments.clock_in_location")}</span>
                {(() => {
                  const distMi = a.clock_in_distance_miles as number | null;
                  const lat = a.clock_in_lat as number;
                  const lng = a.clock_in_lng as number;
                  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                  const isFar = distMi != null && distMi > 1;
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline tabular-nums"
                      >
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </a>
                      {distMi != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full border px-2 py-0.5 ${
                          isFar
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-green-50 border-green-300 text-green-700"
                        }`}>
                          {isFar && <AlertTriangle className="h-3 w-3" />}
                          {distMi.toFixed(2)} mi from clinic
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
          {(a.actual_duration_minutes || a.billable_duration_minutes) && (
            <>
              <div className="border-t" />
              <div className="space-y-2">
                {a.actual_duration_minutes && <Field label={t("appointments.actual_duration")} value={`${a.actual_duration_minutes} min`} />}
                {a.billable_duration_minutes && <Field label={t("appointments.billable_duration")} value={`${a.billable_duration_minutes} min`} />}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {((mediaData as Array<Record<string, unknown>>) ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Images className="h-4 w-4" /> {t("appointments.photos")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(mediaData as Array<{ id: string; public_url: string; filename: string; mime_type: string; uploaded_at: string; interpreter: { name: string } }>).map((m) => (
                <a key={m.id} href={m.public_url} target="_blank" rel="noopener noreferrer" className="group relative">
                  <img
                    src={m.public_url}
                    alt={m.filename}
                    className="h-28 w-28 rounded-lg object-cover border border-border group-hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/50 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">{m.interpreter?.name}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              onSave={async () => { await addNote.mutateAsync(noteText.trim()); setNoteText(""); }}
              isSaving={addNote.isPending}
              placeholder={t("appointments.admin_notes_placeholder")}
              saveLabel={t("common.save")}
            />
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> {t("appointments.activity_log")}
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
                    <p className="text-sm mt-0.5 capitalize">{t(`appointments.activity_${entry.action as string}`, { defaultValue: entry.action as string })}
                      {entry.detail ? <span className="text-muted-foreground"> — {entry.detail as string}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unassign interpreter confirmation dialog */}
      <Dialog open={confirmUnassign} onOpenChange={setConfirmUnassign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("appointments.unassign_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("appointments.unassign_confirm_body", {
              name: ((appt as Record<string, unknown>)?.interpreter as Record<string, unknown>)?.name as string ?? "",
            })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnassign(false)} disabled={unassign.isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={unassign.isPending}
              onClick={async () => {
                try {
                  await unassign.mutateAsync();
                  toast({ title: t("appointments.interpreter_unassigned") });
                  setConfirmUnassign(false);
                  setEditing(false);
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("appointments.unassign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LocationCard({ clinic, physician }: { clinic: Record<string, unknown>; physician: string | null }) {
  const { t } = useTranslation();
  const address = clinic?.address as string | null;
  const parking = clinic?.parking as string | null;
  const clinicName = clinic?.name as string;
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  const embedUrl = address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&zoom=15` : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{t("appointments.location")}</CardTitle>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {embedUrl ? (
          <div className="overflow-hidden rounded-md border">
            <iframe src={embedUrl} width="100%" height="180" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={clinicName} />
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
            {t("appointments.no_address")}
          </div>
        )}
        <div className="space-y-1.5 text-sm">
          {physician && <p className="font-semibold">{physician}</p>}
          <p className="font-semibold">{clinicName}</p>
          {address && (
            <div className="flex gap-1.5 text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="leading-snug">
                {formatUSAddress(address).map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </span>
            </div>
          )}
          {parking && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ParkingCircle className="h-3.5 w-3.5 shrink-0" />
              <p>{parking}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatUSAddress(address: string): string[] {
  const parts = address.split(", ").map((p) => p.trim());
  const lines: string[] = [];
  if (parts[0]) lines.push(parts[0]);
  const cityStateZip = [parts[1], parts[2] && parts[3] ? `${parts[2]} ${parts[3]}` : parts[2] ?? ""].filter(Boolean).join(", ");
  if (cityStateZip) lines.push(cityStateZip);
  if (parts[4]) lines.push(parts[4]);
  return lines.length ? lines : [address];
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function InterpreterSearch({
  interpreters,
  offers,
  excludedFromClinic,
  selectedInterpreters,
  setSelectedInterpreters,
  t,
}: {
  interpreters: Array<Record<string, unknown>>;
  offers: Array<Record<string, unknown>>;
  excludedFromClinic: Set<string>;
  selectedInterpreters: string[];
  setSelectedInterpreters: React.Dispatch<React.SetStateAction<string[]>>;
  t: (key: string) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? interpreters.filter((interp) =>
        (interp.name as string).toLowerCase().includes(search.toLowerCase()),
      )
    : interpreters;

  return (
    <>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("appointments.search_interpreters")}
        autoComplete="off"
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("common.no_results")}</p>
        ) : (
          filtered.map((interp) => {
            const alreadyOffered = offers.some(
              (o) => o.interpreter_id === interp.id && o.status === "pending",
            );
            const declined = offers.some(
              (o) => o.interpreter_id === interp.id && o.status === "declined",
            );
            const unavailable = interp.is_available === false;
            const excluded = excludedFromClinic.has(interp.id as string);
            const disabled = alreadyOffered || declined || unavailable || excluded;
            return (
              <label
                key={interp.id as string}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  declined
                    ? "cursor-not-allowed bg-red-50 border-red-200"
                    : disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selectedInterpreters.includes(interp.id as string)}
                  onChange={(e) =>
                    setSelectedInterpreters(
                      e.target.checked
                        ? [...selectedInterpreters, interp.id as string]
                        : selectedInterpreters.filter((i) => i !== interp.id),
                    )
                  }
                />
                <span className={`text-sm font-medium ${declined ? "line-through text-muted-foreground" : ""}`}>{interp.name as string}</span>
                <span className="text-sm text-muted-foreground capitalize">{interp.type as string}</span>
                {alreadyOffered && (
                  <span className="ml-auto text-xs text-muted-foreground">{t("appointments.offer_pending")}</span>
                )}
                {declined && (
                  <span className="flex-1 text-center text-sm font-bold text-destructive">{t("appointments.offer_declined")}</span>
                )}
                {excluded && !declined && (
                  <span className="ml-auto text-xs font-medium text-destructive">{t("clinics.excluded_from_clinic")}</span>
                )}
                {unavailable && !alreadyOffered && !declined && !excluded && (
                  <span className="ml-auto text-xs font-medium text-amber-600">{t("appointments.unavailable")}</span>
                )}
              </label>
            );
          })
        )}
      </div>
    </>
  );
}

/** Best-effort city extraction from a US address string like
 *  "Street, City, CA, 93940" or "Street, City, IL 62701" */
function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  // "IL 62701" or "CA 93940" — state + zip combined
  if (/^[A-Za-z]{2}\s+\d{5}(-\d{4})?$/.test(last)) {
    return parts[parts.length - 2] ?? null;
  }
  // Pure zip "93940"
  if (/^\d{5}(-\d{4})?$/.test(last) && parts.length >= 3) {
    return parts[parts.length - 3] ?? null;
  }
  // State-only last part (e.g. "California" or "CA")
  if (/^[A-Za-z]+$/.test(last) && parts.length >= 2) {
    return parts[parts.length - 2] ?? null;
  }
  return null;
}

function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground shrink-0 text-sm">{label}</span>
      <div className="w-52 shrink-0">{children}</div>
    </div>
  );
}
