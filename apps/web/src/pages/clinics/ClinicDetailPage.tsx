import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useClinic, useUpdateClinic, useSetClinicInterpreterBlocks, useClinicActivity, useClinicNotes, useAddClinicNote, useUploadClinicNoteImage, useClinicInterpreterNotes, useCreateClinicInterpreterNote, useUpdateClinicInterpreterNote, useDeleteClinicInterpreterNote, useAddClinicDoctor, useRemoveClinicDoctor } from "../../hooks/useClinics.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { NoteInput } from "../../components/shared/NoteInput.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { PhoneInput } from "../../components/ui/PhoneInput.js";
import { formatPhoneInput } from "../../lib/phone.js";
import { PhoneLink } from "../../components/shared/PhoneLink.js";
import { Label } from "../../components/ui/label.js";
import { Textarea } from "../../components/ui/textarea.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { Badge } from "../../components/ui/badge.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { ClipboardList, StickyNote, MapPin, ParkingCircle, ExternalLink, Bell, Pencil, Trash2, Plus, AlertTriangle, Stethoscope, X } from "lucide-react";
import { useAuthStore } from "../../store/auth.js";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SummaryEmailsCard({ clinic, update }: { clinic: Record<string, unknown>; update: ReturnType<typeof useUpdateClinic> }) {
  const { t } = useTranslation();
  const enabled = (clinic.summary_emails_enabled as boolean) ?? false;
  const days = (clinic.summary_email_days as number[]) ?? [];

  function toggleDay(dow: number) {
    const next = days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow].sort((a, b) => a - b);
    update.mutate({ summary_email_days: next });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.clinic_summary_emails_per_clinic")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("clinics.primary_contact_email")}: {(clinic.primary_contact as Record<string, unknown> | null)?.email as string ?? "—"}</p>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => update.mutate({ summary_emails_enabled: !enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-primary" : "bg-input"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.clinic_summary_emails_days_label")}</p>
          <div className="flex gap-1.5 flex-wrap">
            {DOW_LABELS.map((label, dow) => (
              <button
                key={dow}
                type="button"
                onClick={() => toggleDay(dow)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  days.includes(dow)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.clinic_summary_emails_days_hint")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data, isLoading } = useClinic(id!);
  const update = useUpdateClinic(id!);
  const setBlocks = useSetClinicInterpreterBlocks(id!);
  const { data: allInterpreters } = useInterpreters({ limit: "100" });
  const { data: activityLog } = useClinicActivity(id!);
  const { data: adminNotes } = useClinicNotes(id!);
  const addNote = useAddClinicNote(id!);
  const uploadNoteImage = useUploadClinicNoteImage(id!);
  const { data: interpreterNotes } = useClinicInterpreterNotes(id!);
  const createInterpreterNote = useCreateClinicInterpreterNote(id!);
  const updateInterpreterNote = useUpdateClinicInterpreterNote(id!);
  const deleteInterpreterNote = useDeleteClinicInterpreterNote(id!);

  const addDoctor = useAddClinicDoctor(id!);
  const removeDoctor = useRemoveClinicDoctor(id!);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageClinics = hasPermission("manage_clinics");

  const [editing, setEditing] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [pendingBlockIds, setPendingBlockIds] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; content: string; type: string } | null>(null);
  const [noteForm, setNoteForm] = useState({ content: "", type: "notice" });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>{t("common.not_found")}</p>;

  const clinic = data as Record<string, unknown>;
  const isActive = (clinic.is_active as boolean) !== false;
  const contact = clinic.primary_contact as { name?: string; email?: string; phone?: string } | null;
  const excludedInterpreters = (clinic.interpreters_not_allowed ?? []) as Array<{ id: string; name: string }>;
  const doctors = (clinic.doctors ?? []) as Array<{ id: string; name: string }>;

  function startEdit() {
    setForm({
      name: (clinic.name as string) ?? "",
      address: (clinic.address as string) ?? "",
      city: (clinic.city as string) ?? "",
      state: (clinic.state as string) ?? "",
      zip_code: (clinic.zip_code as string) ?? "",
      phone: formatPhoneInput((clinic.phone as string) ?? ""),
      primary_contact_name: contact?.name ?? "",
      primary_contact_email: contact?.email ?? "",
    });
    setEditing(true);
  }

  async function save() {
    try {
      const { primary_contact_name, primary_contact_email, ...rest } = form as {
        primary_contact_name: string;
        primary_contact_email: string;
        [k: string]: unknown;
      };
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== "") body[k] = v;
      }
      if (primary_contact_name || primary_contact_email) {
        body.primary_contact = {
          name: primary_contact_name,
          ...(primary_contact_email ? { email: primary_contact_email } : {}),
        };
      }
      await update.mutateAsync(body);
      toast({ title: t("common.saved") });
      setEditing(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  function openBlockDialog() {
    setPendingBlockIds(excludedInterpreters.map((i) => i.id));
    setBlockDialogOpen(true);
  }

  async function saveBlocks() {
    try {
      await setBlocks.mutateAsync(pendingBlockIds);
      toast({ title: t("common.saved") });
      setBlockDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  function toggleInterpreter(interpreterId: string, checked: boolean) {
    setPendingBlockIds((prev) =>
      checked ? [...prev, interpreterId] : prev.filter((i) => i !== interpreterId),
    );
  }

  function openNewInterpreterNote() {
    setEditingNote(null);
    setNoteForm({ content: "", type: "notice" });
    setNoteDialogOpen(true);
  }

  function openEditInterpreterNote(note: { id: string; content: string; type: string }) {
    setEditingNote(note);
    setNoteForm({ content: note.content, type: note.type });
    setNoteDialogOpen(true);
  }

  async function saveInterpreterNote() {
    try {
      if (editingNote) {
        await updateInterpreterNote.mutateAsync({ noteId: editingNote.id, body: noteForm });
      } else {
        await createInterpreterNote.mutateAsync(noteForm);
      }
      toast({ title: t("common.saved") });
      setNoteDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function toggleInterpreterNoteActive(noteId: string, is_active: boolean) {
    try {
      await updateInterpreterNote.mutateAsync({ noteId, body: { is_active } });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function removeInterpreterNote(noteId: string) {
    try {
      await deleteInterpreterNote.mutateAsync(noteId);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const fields = ["name", "address", "city", "state", "zip_code", "primary_contact_name", "primary_contact_email"] as const;
  const interpreterList = (allInterpreters?.data ?? []) as Array<{ id: string; name: string; type: string }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {clinic.name as string}
            {!isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" /> {t("clinics.deactivated")}
              </span>
            )}
          </span>
        }
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button onClick={save} disabled={update.isPending}>{t("common.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEdit}>{t("common.edit")}</Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("clinics.details")}</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f} className="space-y-1">
                    <Label>{t(`clinics.${f}`)}</Label>
                    <Input value={form[f] as string ?? ""} onChange={(e) => setForm(s => ({ ...s, [f]: e.target.value }))} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>{t("clinics.phone")}</Label>
                  <PhoneInput value={form.phone as string ?? ""} onChange={(v) => setForm(s => ({ ...s, phone: v }))} />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">{t("clinics.name")}</p>
                  <p className="font-medium">{clinic.name as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.address")}</p>
                  <p className="font-medium">{clinic.address as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.city")}</p>
                  <p className="font-medium">{clinic.city as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.state")}</p>
                  <p className="font-medium">{clinic.state as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.zip_code")}</p>
                  <p className="font-medium">{clinic.zip_code as string ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.phone")}</p>
                  <p className="font-medium"><PhoneLink phone={clinic.phone as string} /></p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.primary_contact_name")}</p>
                  <p className="font-medium">{contact?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clinics.primary_contact_email")}</p>
                  <p className="font-medium">{contact?.email ?? "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <LocationCard
          name={clinic.name as string}
          address={clinic.address as string | null}
          parking={clinic.parking as string | null}
        />
      </div>

      {/* Summary Emails */}
      <SummaryEmailsCard clinic={clinic} update={update} />

      {/* Excluded Interpreters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("clinics.excluded_interpreters")}</CardTitle>
          <Button variant="outline" size="sm" onClick={openBlockDialog}>{t("common.edit")}</Button>
        </CardHeader>
        <CardContent>
          {excludedInterpreters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clinics.no_excluded_interpreters")}</p>
          ) : (
            <ul className="space-y-1">
              {excludedInterpreters.map((interp) => (
                <li key={interp.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span>{interp.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Doctors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" /> {t("clinics.doctors")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clinics.no_doctors")}</p>
          ) : (
            <ul className="space-y-1">
              {doctors.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{doc.name}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await removeDoctor.mutateAsync(doc.id);
                      } catch {
                        toast({ title: t("common.error"), variant: "destructive" });
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title={t("common.remove")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2 pt-1"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = newDoctorName.trim();
              if (!name) return;
              try {
                await addDoctor.mutateAsync(name);
                setNewDoctorName("");
              } catch {
                toast({ title: t("common.error"), variant: "destructive" });
              }
            }}
          >
            <Input
              value={newDoctorName}
              onChange={(e) => setNewDoctorName(e.target.value)}
              placeholder={t("clinics.doctor_name_placeholder")}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!newDoctorName.trim() || addDoctor.isPending}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {t("clinics.add_doctor")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Interpreter Notes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> {t("clinics.interpreter_notes")}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openNewInterpreterNote}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("common.add")}
          </Button>
        </CardHeader>
        <CardContent>
          {!(interpreterNotes as Array<Record<string, unknown>> | undefined)?.length ? (
            <p className="text-sm text-muted-foreground">{t("clinics.no_interpreter_notes")}</p>
          ) : (
            <div className="space-y-3">
              {(interpreterNotes as Array<Record<string, unknown>>).map((note) => (
                <div
                  key={note.id as string}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${!note.is_active ? "opacity-50" : ""}`}
                >
                  <InterpreterNoteBadge type={note.type as string} />
                  <p className="flex-1 text-sm whitespace-pre-wrap">{note.content as string}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditInterpreterNote({ id: note.id as string, content: note.content as string, type: note.type as string })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleInterpreterNoteActive(note.id as string, !(note.is_active as boolean))}
                      title={note.is_active ? t("common.deactivate") : t("common.activate")}
                    >
                      <span className={`block h-2 w-2 rounded-full ${note.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeInterpreterNote(note.id as string)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Admin Notes */}
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

        {/* Activity Log */}
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

      {/* Clinic Status */}
      {canManageClinics && (
        <Card className={!isActive ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {!isActive && <AlertTriangle className="h-4 w-4 text-red-500" />}
              {t("clinics.status")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isActive ? t("clinics.status_active_description") : t("clinics.status_inactive_description")}
            </p>
            {isActive ? (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => setDeactivateDialogOpen(true)}
                  className="h-4 w-4 accent-destructive"
                />
                <span className="text-sm font-medium text-destructive">{t("clinics.deactivate_label")}</span>
              </label>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 hover:bg-green-100 transition-colors dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-950/50">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => setReactivateDialogOpen(true)}
                  className="h-4 w-4 accent-green-600"
                />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">{t("clinics.reactivate_label")}</span>
              </label>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t("clinics.deactivate_confirm_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("clinics.deactivate_confirm_body")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ is_active: false });
                  setDeactivateDialogOpen(false);
                  toast({ title: t("clinics.deactivated_toast") });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("clinics.deactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Confirmation Dialog */}
      <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clinics.reactivate_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("clinics.reactivate_confirm_body")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ is_active: true });
                  setReactivateDialogOpen(false);
                  toast({ title: t("clinics.reactivated") });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("clinics.reactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interpreter Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingNote ? t("clinics.edit_interpreter_note") : t("clinics.add_interpreter_note")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("clinics.note_type")}</Label>
              <Select value={noteForm.type} onValueChange={(v) => setNoteForm((s) => ({ ...s, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="important">{t("clinics.note_type_important")}</SelectItem>
                  <SelectItem value="notice">{t("clinics.note_type_notice")}</SelectItem>
                  <SelectItem value="info">{t("clinics.note_type_info")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("clinics.note_content")}</Label>
              <Textarea
                rows={4}
                value={noteForm.content}
                onChange={(e) => setNoteForm((s) => ({ ...s, content: e.target.value }))}
                placeholder={t("clinics.note_content_placeholder")}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">{noteForm.content.length}/1000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={saveInterpreterNote}
              disabled={!noteForm.content.trim() || createInterpreterNote.isPending || updateInterpreterNote.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interpreter Block Dialog */}

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clinics.excluded_interpreters")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("clinics.select_interpreters_to_exclude")}</p>
          <div className="max-h-72 overflow-y-auto space-y-1 rounded-md border p-2">
            {interpreterList.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">{t("interpreters.empty")}</p>
            ) : (
              interpreterList.map((interp) => {
                const checked = pendingBlockIds.includes(interp.id);
                return (
                  <label
                    key={interp.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleInterpreter(interp.id, e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="flex-1 text-sm font-medium">{interp.name}</span>
                    <span className="text-xs capitalize text-muted-foreground">{interp.type}</span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveBlocks} disabled={setBlocks.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InterpreterNoteBadge({ type }: { type: string }) {
  if (type === "important") return <Badge variant="destructive" className="shrink-0 text-xs">Important</Badge>;
  if (type === "notice") return <Badge variant="secondary" className="shrink-0 text-xs bg-amber-100 text-amber-800 border-amber-200">Notice</Badge>;
  return <Badge variant="outline" className="shrink-0 text-xs">Info</Badge>;
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

function LocationCard({ name, address, parking }: { name: string; address: string | null; parking: string | null }) {
  const { t } = useTranslation();
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
            <iframe
              src={embedUrl}
              width="100%"
              height="200"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={name}
            />
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
            {t("appointments.no_address")}
          </div>
        )}
        <div className="space-y-1.5 text-sm">
          <p className="font-semibold">{name}</p>
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
