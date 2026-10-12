import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MapPin, Navigation, Car, Clock, LogIn, LogOut, UserPlus, FileText, Camera, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { useAppointmentDetail, useClockIn, useClockOut, usePatientArrived, useAddShiftNotes, useSubmitFollowUp, useUploadAppointmentMedia } from "../hooks/useAppointments";

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useAppointmentDetail(id!);

  const clockIn = useClockIn(id!);
  const clockOut = useClockOut(id!);
  const patientArrived = usePatientArrived(id!);
  const addNotes = useAddShiftNotes(id!);
  const submitFollowUp = useSubmitFollowUp(id!);
  const uploadMedia = useUploadAppointmentMedia(id!);

  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [followUp, setFollowUp] = useState({
    has_follow_up: true,
    same_physician: true,
    same_clinic: true,
    follow_up_datetime: "",
    notes: "",
  });

  if (isLoading) return <div className="flex items-center justify-center h-full text-[var(--color-text-subtle)]">{t("common.loading")}</div>;
  if (!data) return <div className="flex items-center justify-center h-full text-[var(--color-text-subtle)]">{t("common.not_found")}</div>;

  const appt = data as Record<string, unknown>;
  const clinic = appt.clinic as Record<string, unknown> | null;
  const patient = appt.patient as Record<string, unknown> | null;
  const agency = appt.agency as Record<string, unknown> | null;
  const interpreterNotes = (clinic?.interpreter_notes as Array<{ id: string; content: string; type: string }>) ?? [];
  const invoice = appt.invoice as { status: string; amount: number } | null | undefined;
  const status = appt.status as string;
  const dt = new Date(appt.date_time as string);

  async function handleClockIn() {
    try {
      let coords: { lat: number; lng: number } | undefined;
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
          );
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {}
      }
      await clockIn.mutateAsync(coords);
      refetch();
    } catch {
      alert(t("common.error"));
    }
  }

  async function handlePatientArrived() {
    try { await patientArrived.mutateAsync(); refetch(); }
    catch { alert(t("common.error")); }
  }

  async function handleClockOut() {
    try { await clockOut.mutateAsync(); refetch(); setShowFollowUp(true); }
    catch { alert(t("common.error")); }
  }

  async function handleSaveNotes() {
    try { await addNotes.mutateAsync({ notes }); setShowNotes(false); setNotes(""); setNotesSaved(true); }
    catch { alert(t("common.error")); }
  }

  async function handleUploadPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try { await uploadMedia.mutateAsync(file); refetch(); }
      catch { alert(t("common.error")); }
    };
    input.click();
  }

  async function handleSubmitFollowUp() {
    try {
      await submitFollowUp.mutateAsync(followUp.has_follow_up ? followUp : { has_follow_up: false });
      setShowFollowUp(false);
      setFollowUpSent(true);
    } catch { alert(t("common.error")); }
  }

  const address = clinic?.address as string | null;
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-surface border-b border-[var(--color-border)] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{(clinic?.name as string) ?? "—"}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {/* Invoice banner */}
        {invoice && (
          <div className={`flex items-center gap-3 rounded-xl p-4 border ${
            invoice.status === "approved" ? "bg-green-50 border-green-300" : "bg-amber-50 border-amber-300"
          }`}>
            <CheckCircle size={20} className={invoice.status === "approved" ? "text-green-700" : "text-amber-700"} />
            <div>
              <p className={`text-sm font-bold ${invoice.status === "approved" ? "text-green-700" : "text-amber-700"}`}>
                {invoice.status === "approved" ? t("invoices.status_approved") : t("invoices.invoice_submitted")}
              </p>
              <p className={`text-lg font-extrabold ${invoice.status === "approved" ? "text-green-700" : "text-amber-700"}`}>
                ${Number(invoice.amount).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Patient */}
        <Section label={t("appointments.patient")} value={(patient?.name as string) ?? "—"} />

        {/* Date & Time */}
        <Section label={t("appointments.date_time")} value={dt.toLocaleString()} />

        {/* Clock times for completed */}
        {status === "completed" && (appt.clock_in_time || appt.clock_out_time) && (
          <div className="bg-surface rounded-lg p-4 flex items-start gap-2">
            <Clock size={16} className="text-[var(--color-text-muted)] mt-0.5" />
            <div className="space-y-1">
              {appt.clock_in_time && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t("appointments.clock_in")}: <span className="font-semibold text-[var(--color-text)]">{new Date(appt.clock_in_time as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </p>
              )}
              {appt.clock_out_time && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t("appointments.clock_out")}: <span className="font-semibold text-[var(--color-text)]">{new Date(appt.clock_out_time as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        <Section label={t("appointments.status")} value={status.replace(/_/g, " ")} />

        {/* Location */}
        <div className="bg-surface rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} className="text-forest" />
            <span className="text-xs font-semibold text-forest uppercase tracking-wide">{t("appointments.location")}</span>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener" className="ml-auto flex items-center gap-1 text-xs font-semibold text-forest">
                <Navigation size={14} />
                {t("appointments.open_maps")}
              </a>
            )}
          </div>
          {address && mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden mb-2" style={{ height: 160 }}>
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&zoom=15`}
                className="w-full h-full border-0 pointer-events-none"
                loading="lazy"
              />
            </a>
          )}
          <p className="font-semibold">{(clinic?.name as string) ?? "—"}</p>
          {address && <p className="text-sm text-[var(--color-text-muted)] mt-1">{address}</p>}
          {clinic?.parking && (
            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-[var(--color-border)]">
              <Car size={14} className="text-[var(--color-text-muted)] mt-0.5" />
              <p className="text-sm text-[var(--color-text-muted)]">{clinic.parking as string}</p>
            </div>
          )}
        </div>

        {/* Agency */}
        {agency?.name && <Section label={t("appointments.agency")} value={agency.name as string} />}

        {/* Interpreter notes */}
        {interpreterNotes.length > 0 && (
          <div className="space-y-2">
            {interpreterNotes.map((note) => (
              <div key={note.id} className={`rounded-xl p-3 border-l-4 ${
                note.type === "important" ? "bg-red-50 border-l-red-500" :
                note.type === "notice" ? "bg-amber-50 border-l-amber-500" :
                "bg-blue-50 border-l-blue-500"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {note.type === "important" ? <AlertCircle size={14} className="text-red-700" /> :
                   note.type === "notice" ? <AlertTriangle size={14} className="text-amber-700" /> :
                   <Info size={14} className="text-blue-700" />}
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    note.type === "important" ? "text-red-700" : note.type === "notice" ? "text-amber-700" : "text-blue-700"
                  }`}>{note.type}</span>
                </div>
                <p className={`text-sm ${
                  note.type === "important" ? "text-red-900" : note.type === "notice" ? "text-amber-900" : "text-blue-900"
                }`}>{note.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Language */}
        <Section label={t("appointments.language")} value={appt.language as string} />

        {/* Clock In */}
        {status === "accepted" && (
          <ActionButton onClick={handleClockIn} loading={clockIn.isPending} icon={<LogIn size={20} />} className="bg-forest">
            {t("appointments.clock_in")}
          </ActionButton>
        )}

        {/* In Progress actions */}
        {status === "in_progress" && (
          <>
            {appt.clock_in_time && (
              <Section label={t("appointments.clocked_in_at")} value={new Date(appt.clock_in_time as string).toLocaleTimeString()} />
            )}
            {appt.patient_arrived_at ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl px-4 py-3">
                <CheckCircle size={18} className="text-green-600" />
                <span className="text-green-700 text-sm font-semibold">
                  {t("appointments.patient_arrived_at", { time: new Date(appt.patient_arrived_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                </span>
              </div>
            ) : (
              <ActionButton onClick={handlePatientArrived} loading={patientArrived.isPending} icon={<UserPlus size={20} />} className="bg-green-600">
                {t("appointments.patient_arrived")}
              </ActionButton>
            )}
            <ActionButton onClick={handleClockOut} loading={clockOut.isPending} icon={<LogOut size={20} />} className="bg-red-600">
              {t("appointments.clock_out")}
            </ActionButton>
          </>
        )}

        {/* Notes */}
        {(status === "completed" || status === "in_progress") && (
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="w-full flex items-center justify-center gap-2 bg-forest-light border border-[var(--color-border-strong)] rounded-xl py-3.5 text-forest font-semibold active:opacity-80"
          >
            <FileText size={20} />
            {t("appointments.add_notes")}
          </button>
        )}

        {showNotes && (
          <div className="bg-surface rounded-lg p-4 space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("appointments.notes_placeholder")}
              rows={4}
              className="w-full border border-[var(--color-border)] rounded-lg p-3 text-sm resize-none outline-none focus:border-forest"
            />
            <ActionButton onClick={handleSaveNotes} loading={addNotes.isPending} className="bg-forest">
              {t("common.save")}
            </ActionButton>
          </div>
        )}

        {/* Follow-up form */}
        {showFollowUp && (
          <div className="bg-surface rounded-xl p-4 border border-[var(--color-border-strong)] space-y-3">
            <p className="font-semibold">{t("follow_up.question")}</p>
            <ToggleRow
              value={followUp.has_follow_up}
              onChange={(v) => setFollowUp((s) => ({ ...s, has_follow_up: v }))}
            />
            {followUp.has_follow_up && (
              <>
                <label className="block text-sm text-[var(--color-text-muted)]">{t("follow_up.same_physician")}</label>
                <ToggleRow value={followUp.same_physician} onChange={(v) => setFollowUp((s) => ({ ...s, same_physician: v }))} />
                <label className="block text-sm text-[var(--color-text-muted)]">{t("follow_up.same_clinic")}</label>
                <ToggleRow value={followUp.same_clinic} onChange={(v) => setFollowUp((s) => ({ ...s, same_clinic: v }))} />
                <label className="block text-sm text-[var(--color-text-muted)]">{t("follow_up.date_time")}</label>
                <input
                  type="datetime-local"
                  value={followUp.follow_up_datetime ? new Date(followUp.follow_up_datetime).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setFollowUp((s) => ({ ...s, follow_up_datetime: new Date(e.target.value).toISOString() }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-forest"
                />
              </>
            )}
            <ActionButton onClick={handleSubmitFollowUp} loading={submitFollowUp.isPending} className="bg-forest">
              {t("common.submit")}
            </ActionButton>
          </div>
        )}

        {notesSaved && <SuccessBanner text={t("appointments.notes_saved")} />}
        {followUpSent && <SuccessBanner text={t("appointments.follow_up_sent")} />}

        {/* Photos */}
        {(status === "in_progress" || status === "completed") && (() => {
          type MediaItem = { id: string; public_url: string; filename: string; mime_type: string };
          const mediaList = (appt.media as MediaItem[] | undefined) ?? [];
          const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
          const serverRoot = apiBase.replace(/\/api\/v1\/?$/, "");
          return (
            <div className="bg-surface rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-forest" />
                <span className="text-xs font-semibold text-forest uppercase tracking-wide">{t("appointments.photos")}</span>
              </div>
              {mediaList.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {mediaList.map((item) => {
                    const url = item.public_url.startsWith("http") ? item.public_url : `${serverRoot}${item.public_url}`;
                    return <img key={item.id} src={url} className="w-full aspect-square object-cover rounded-lg" />;
                  })}
                </div>
              )}
              <button
                onClick={handleUploadPhoto}
                disabled={uploadMedia.isPending}
                className="w-full flex items-center justify-center gap-2 bg-forest-light border border-[var(--color-border-strong)] rounded-xl py-3 text-forest font-semibold disabled:opacity-60 active:opacity-80"
              >
                {uploadMedia.isPending ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                {uploadMedia.isPending ? t("common.uploading") : t("appointments.upload_photo")}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg p-4">
      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ActionButton({ onClick, loading, icon, className, children }: {
  onClick: () => void;
  loading: boolean;
  icon?: React.ReactNode;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-semibold disabled:opacity-60 active:opacity-80 transition-opacity ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

function ToggleRow({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange(true)}
        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
          value ? "bg-forest text-white border-forest" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
        }`}
      >{t("common.yes")}</button>
      <button
        onClick={() => onChange(false)}
        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
          !value ? "bg-forest text-white border-forest" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
        }`}
      >{t("common.no")}</button>
    </div>
  );
}

function SuccessBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl px-4 py-3">
      <CheckCircle size={18} className="text-green-600" />
      <span className="text-green-700 text-sm font-semibold">{text}</span>
    </div>
  );
}
