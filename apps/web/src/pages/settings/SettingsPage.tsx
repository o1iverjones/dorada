import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSystemSettings, useUpdateSystemSettings, useInterpreterRates, useUpdateAppointmentType, useDeleteAppointmentType, useReminderConfigs, useCreateReminderConfig, useUpdateReminderConfig, useDeleteReminderConfig, type ReminderConfig } from "../../hooks/useSettings.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";
import { useNavigate } from "react-router-dom";
import { Trash2, Pencil, Check, X, Upload, Download, CheckCircle, XCircle, AlertCircle, FileText, MapPin } from "lucide-react";
import { useAuthStore } from "../../store/auth.js";
import { useCities, useCreateCity, useRenameCity, useDeleteCity } from "../../hooks/useCities.js";
import { cn } from "../../lib/utils.js";

interface Language { id?: string; code: string; name: string; active: boolean; }
interface AppointmentType { id: string; name: string; pay_model: string; minimum_billable_minutes: number; is_active: boolean; }

function CitiesCard() {
  const { data: cities = [] } = useCities();
  const createCity = useCreateCity();
  const renameCity = useRenameCity();
  const deleteCity = useDeleteCity();
  const [newCityName, setNewCityName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startRename(city: { id: string; name: string }) {
    setEditingId(city.id);
    setEditingName(city.name);
  }

  function commitRename() {
    if (!editingId || !editingName.trim()) return;
    renameCity.mutate(
      { id: editingId, name: editingName.trim() },
      {
        onSuccess: () => setEditingId(null),
        onError: () => toast({ title: "A city with that name already exists.", variant: "destructive" }),
      },
    );
  }

  function addCity() {
    const name = newCityName.trim();
    if (!name) return;
    createCity.mutate(name, {
      onSuccess: () => setNewCityName(""),
      onError: () => toast({ title: "A city with that name already exists.", variant: "destructive" }),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Coverage Cities
        </CardTitle>
        <CardDescription>Manage the list of cities available for interpreter coverage areas. Renaming or deleting a city updates all interpreters automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(cities as Array<{ id: string; name: string }>).map((city) =>
            editingId === city.id ? (
              <span key={city.id} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-1">
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-28 bg-transparent text-xs outline-none"
                  autoFocus
                />
                <button type="button" onClick={commitRename} disabled={renameCity.isPending} className="text-primary hover:opacity-70">
                  <Check className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <span key={city.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {city.name}
                <button type="button" onClick={() => startRename(city)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => deleteCity.mutate(city.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          )}
          {(cities as Array<unknown>).length === 0 && (
            <p className="text-sm text-muted-foreground">No cities added yet.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="City name"
            value={newCityName}
            onChange={(e) => setNewCityName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCity(); }}
            className="max-w-xs"
          />
          <Button onClick={addCity} disabled={!newCityName.trim() || createCity.isPending}>
            Add city
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReminderRow({ reminder, t }: { reminder: ReminderConfig; t: (k: string) => string }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: "", offset_minutes: 0 });
  const update = useUpdateReminderConfig(reminder.id);
  const remove = useDeleteReminderConfig();

  function startEdit() {
    setForm({ label: reminder.label, offset_minutes: reminder.offset_minutes });
    setEditing(true);
  }

  async function save() {
    try {
      await update.mutateAsync({ label: form.label, offset_minutes: form.offset_minutes });
      setEditing(false);
      toast({ title: t("common.saved") });
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    }
  }

  if (editing) {
    return (
      <div className="rounded-md border p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={form.label}
            onChange={(e) => setForm(s => ({ ...s, label: e.target.value }))}
            placeholder={t("settings.reminder_label")}
          />
          <div className="relative">
            <Input
              type="number"
              min={1}
              value={form.offset_minutes}
              onChange={(e) => setForm(s => ({ ...s, offset_minutes: parseInt(e.target.value) || 0 }))}
              className="pr-10"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">min</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!form.label.trim() || form.offset_minutes < 1 || update.isPending}>{t("common.save_changes")}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <div>
        <p className="font-medium">{reminder.label}</p>
        <p className="text-xs text-muted-foreground">{reminder.offset_minutes} {t("settings.reminder_offset")}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={startEdit} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={() => remove.mutate(reminder.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function AppointmentTypeRow({ ty, t }: { ty: AppointmentType; t: (k: string) => string }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", pay_model: "hourly", minimum_billable_hours: 1 });
  const update = useUpdateAppointmentType(ty.id);
  const remove = useDeleteAppointmentType(ty.id);

  function startEdit() {
    setForm({ name: ty.name, pay_model: ty.pay_model, minimum_billable_hours: ty.minimum_billable_minutes / 60 });
    setEditing(true);
  }

  async function save() {
    try {
      await update.mutateAsync({
        name: form.name,
        pay_model: form.pay_model,
        minimum_billable_minutes: Math.round(form.minimum_billable_hours * 60),
      });
      setEditing(false);
      toast({ title: t("common.saved") });
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    }
  }

  if (editing) {
    return (
      <div className="rounded-md border p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            value={form.name}
            onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
            placeholder={t("settings.type_name")}
          />
          <select
            className="rounded-md border p-2 text-sm"
            value={form.pay_model}
            onChange={(e) => setForm(s => ({ ...s, pay_model: e.target.value }))}
          >
            <option value="hourly">{t("settings.hourly")}</option>
            <option value="flat_rate">{t("settings.flat_rate")}</option>
          </select>
          <div className="relative">
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={form.minimum_billable_hours}
              onChange={(e) => setForm(s => ({ ...s, minimum_billable_hours: parseFloat(e.target.value) }))}
              className="pr-10"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">hrs</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!form.name || update.isPending}>
            <Check className="h-3.5 w-3.5 mr-1" />{t("common.save_changes")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5 mr-1" />{t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span className="font-medium">{ty.name}</span>
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>{ty.pay_model}</span>
        <span>{(ty.minimum_billable_minutes / 60).toFixed(1)} hrs min</span>
        <button type="button" onClick={startEdit} className="hover:text-foreground transition-colors">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(t("settings.confirm_delete_type"))) remove.mutate();
          }}
          disabled={remove.isPending}
          className="text-destructive hover:text-destructive/80 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── CSV Import (super admin only) ───────────────────────────────────────────

type EntityType = "interpreters" | "clinics" | "patients" | "agencies" | "appointments";
interface ImportResult { total: number; created: number; updated: number; errors: Array<{ row: number; message: string }>; }
const ENTITY_KEYS: EntityType[] = ["interpreters", "clinics", "patients", "agencies", "appointments"];

function CsvImportCard() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<EntityType>("interpreters");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File | null) {
    if (!f) return;
    if (!f.name.endsWith(".csv")) { setImportError(t("import.invalid_file_type")); return; }
    setFile(f); setResult(null); setImportError(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setImportError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.uploadFile<ImportResult>(`/import/${selected}`, fd);
      setResult(data); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadTemplate() {
    const a = document.createElement("a");
    a.href = `/api/v1/import/template/${selected}`;
    a.setAttribute("download", `${selected}-template.csv`);
    a.click();
  }

  const entityLabel = t(`import.entity.${selected}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {t("import.title")}
        </CardTitle>
        <CardDescription>{t("import.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Entity selector */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ENTITY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => { setSelected(key); setFile(null); setResult(null); setImportError(null); }}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                selected === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {t(`import.entity.${key}`)}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Instructions + template */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("import.format_card_title", { entity: entityLabel })}</p>
            <p className="text-xs text-muted-foreground">{t(`import.desc.${selected}`)}</p>
            <div className="flex gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{t(`import.note.${selected}`)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {t("import.download_template", { entity: entityLabel })}
            </Button>
            <p className="text-xs text-muted-foreground">{t("import.template_hint")}</p>
          </div>

          {/* Upload */}
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0] ?? null); }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50",
              )}
            >
              {file ? (
                <>
                  <FileText className="h-7 w-7 text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{t("import.file_size", { size: (file.size / 1024).toFixed(1) })}</p>
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-primary">{t("import.click_to_select")}</span>{" "}{t("import.drag_drop")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("import.csv_only")}</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} />
            {importError && (
              <div className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />{importError}
              </div>
            )}
            <Button onClick={handleImport} disabled={!file || loading} className="w-full">
              {loading ? t("import.importing") : t("import.import_button", { entity: entityLabel })}
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />{t("import.results_title")}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("import.total_rows")}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600 mt-1">{t("import.created")}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600 mt-1">{t("import.updated")}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/20 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-destructive/5">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-destructive w-20">{t("import.error_row")}</th>
                      <th className="px-4 py-2 text-left font-medium text-destructive">{t("import.error_message")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, idx) => (
                      <tr key={idx} className={cn("border-t border-destructive/10", idx % 2 === 0 ? "bg-white" : "bg-destructive/5")}>
                        <td className="px-4 py-2 font-mono text-xs">{err.row}</td>
                        <td className="px-4 py-2 text-muted-foreground">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSystemSettings();
  const update = useUpdateSystemSettings();
  const qc = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRemoveLanguages = hasPermission("manage_admin_users");
  const [removingMode, setRemovingMode] = useState(false);

  const [form, setForm] = useState({
    default_certified_rate: 0,
    default_qualified_rate: 0,
    follow_up_reminder_window_minutes: 60,
    follow_up_max_reminders: 2,
    timezone: "America/Los_Angeles",
    long_appointment_alert_hours: 1,
    long_appointment_alert_mins: 45,
  });

  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (settings) {
      const s = settings as Record<string, unknown>;
      const rates = s.default_pay_rates as Record<string, number> | undefined;
      const followUp = s.follow_up_config as Record<string, number> | undefined;
      const alertMinutes = (s.long_appointment_alert_minutes as number) ?? 105;
      setForm({
        default_certified_rate: rates?.certified ?? 0,
        default_qualified_rate: rates?.qualified ?? 0,
        follow_up_reminder_window_minutes: followUp?.non_response_window_minutes ?? 60,
        follow_up_max_reminders: followUp?.max_reminders ?? 2,
        timezone: (s.timezone as string) ?? "America/Los_Angeles",
        long_appointment_alert_hours: Math.floor(alertMinutes / 60),
        long_appointment_alert_mins: alertMinutes % 60,
      });
      setOrgName((s.organization_name as string) ?? "");
    }
  }, [settings]);

  const patchLanguages = useMutation({
    mutationFn: (body: unknown) => api.patch("/settings/languages", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
  const createType = useMutation({
    mutationFn: (body: unknown) => api.post("/settings/appointment-types", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });

  const [newLang, setNewLang] = useState({ code: "", name: "" });
  const [newType, setNewType] = useState({ name: "", pay_model: "hourly", minimum_billable_hours: 1 });
  const [newRate, setNewRate] = useState({ title: "", amount: "" });

  const { data: ratesData, refetch: refetchRates } = useInterpreterRates();
  const rates = ratesData?.data ?? [];
  const { data: reminderConfigs } = useReminderConfigs();
  const reminders = (reminderConfigs ?? []) as ReminderConfig[];
  const createReminder = useCreateReminderConfig();
  const [newReminder, setNewReminder] = useState({ label: "", offset_minutes: "" });

  const createRate = useMutation({
    mutationFn: (body: { title: string; amount: number }) => api.post("/settings/interpreter-rates", body),
    onSuccess: () => refetchRates(),
  });
  const deleteRate = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/interpreter-rates/${id}`),
    onSuccess: () => refetchRates(),
  });

  async function saveSettings() {
    try {
      await update.mutateAsync({
        default_pay_rates: {
          certified: form.default_certified_rate,
          qualified: form.default_qualified_rate,
        },
        follow_up_config: {
          non_response_window_minutes: form.follow_up_reminder_window_minutes,
          max_reminders: form.follow_up_max_reminders,
        },
        timezone: form.timezone,
        long_appointment_alert_minutes: form.long_appointment_alert_hours * 60 + form.long_appointment_alert_mins,
      });
      toast({ title: t("common.saved") });
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" });
    }
  }

  function addLanguage() {
    const s = settings as Record<string, unknown> | undefined;
    const existing = (s?.languages ?? []) as Language[];
    const merged = [
      ...existing.map((l) => ({ code: l.code, name: l.name, active: l.active })),
      { code: newLang.code.trim(), name: newLang.name.trim(), active: true },
    ];
    patchLanguages.mutate({ languages: merged });
    setNewLang({ code: "", name: "" });
  }

  function addType() {
    createType.mutate({
      name: newType.name,
      pay_model: newType.pay_model,
      minimum_billable_minutes: Math.round(newType.minimum_billable_hours * 60),
    });
    setNewType({ name: "", pay_model: "hourly", minimum_billable_hours: 1 });
  }

  if (isLoading) return <LoadingSpinner />;

  const s = settings as Record<string, unknown> | undefined;
  const languages = (s?.languages ?? []) as Language[];
  const types = (s?.appointment_types ?? []) as AppointmentType[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.title")}
        actions={
          <Button variant="outline" onClick={() => navigate("/settings/localization")}>
            {t("settings.manage_localization")}
          </Button>
        }
      />

      {hasPermission("manage_system_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.organization_name")}</CardTitle>
            <CardDescription>{t("settings.organization_name_description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 items-end">
            <div className="space-y-1 flex-1 max-w-sm">
              <Label htmlFor="org-name">{t("settings.organization_name")}</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Prana Precision Health"
                maxLength={100}
              />
            </div>
            <Button
              onClick={() => update.mutate(
                { organization_name: orgName.trim() || null },
                { onSuccess: () => toast({ title: t("common.saved") }) },
              )}
              disabled={update.isPending}
            >
              {t("common.save_changes")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("settings.pay_rates")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{t("settings.certified_rate")}</Label>
            <Input type="number" step="0.01" min={0} value={form.default_certified_rate} onChange={(e) => setForm(s => ({ ...s, default_certified_rate: parseFloat(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label>{t("settings.qualified_rate")}</Label>
            <Input type="number" step="0.01" min={0} value={form.default_qualified_rate} onChange={(e) => setForm(s => ({ ...s, default_qualified_rate: parseFloat(e.target.value) }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.follow_up_config")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{t("settings.reminder_window_minutes")}</Label>
            <Input type="number" min={1} value={form.follow_up_reminder_window_minutes} onChange={(e) => setForm(s => ({ ...s, follow_up_reminder_window_minutes: parseInt(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label>{t("settings.max_reminders")}</Label>
            <Input type="number" min={0} max={10} value={form.follow_up_max_reminders} onChange={(e) => setForm(s => ({ ...s, follow_up_max_reminders: parseInt(e.target.value) }))} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveSettings} disabled={update.isPending}>{t("common.save_changes")}</Button>

      <Card>
        <CardHeader><CardTitle>{t("settings.interpreter_rates")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {rates.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{r.title}</span>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>${r.amount.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => deleteRate.mutate(r.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {rates.length === 0 && <p className="text-sm text-muted-foreground">{t("settings.no_rates")}</p>}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("settings.rate_title")}
              value={newRate.title}
              onChange={(e) => setNewRate(s => ({ ...s, title: e.target.value }))}
              className="max-w-xs"
            />
            <Input
              type="number"
              placeholder={t("settings.rate_amount")}
              value={newRate.amount}
              onChange={(e) => setNewRate(s => ({ ...s, amount: e.target.value }))}
              className="max-w-32"
              min={0}
              step="0.01"
            />
            <Button
              onClick={() => {
                createRate.mutate({ title: newRate.title.trim(), amount: parseFloat(newRate.amount) });
                setNewRate({ title: "", amount: "" });
              }}
              disabled={!newRate.title.trim() || !newRate.amount || createRate.isPending}
            >
              {t("common.add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.appointment_types")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {types.map((ty) => (
              <AppointmentTypeRow key={ty.id} ty={ty} t={t} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder={t("settings.type_name")} value={newType.name} onChange={(e) => setNewType(s => ({ ...s, name: e.target.value }))} />
            <select className="rounded-md border p-2 text-sm" value={newType.pay_model} onChange={(e) => setNewType(s => ({ ...s, pay_model: e.target.value }))}>
              <option value="hourly">{t("settings.hourly")}</option>
              <option value="flat_rate">{t("settings.flat_rate")}</option>
            </select>
            <div className="relative">
              <Input type="number" min={0.5} step={0.5} value={newType.minimum_billable_hours} onChange={(e) => setNewType(s => ({ ...s, minimum_billable_hours: parseFloat(e.target.value) }))} className="pr-10" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">hrs</span>
            </div>
          </div>
          <Button onClick={addType} disabled={!newType.name || createType.isPending}>{t("settings.add_type")}</Button>
        </CardContent>
      </Card>

      <CitiesCard />

      {hasPermission("manage_system_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.interpreter_reminders")}</CardTitle>
            <CardDescription>{t("settings.reminders_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {reminders.map((r) => <ReminderRow key={r.id} reminder={r} t={t} />)}
              {reminders.length === 0 && <p className="text-sm text-muted-foreground">{t("settings.no_reminders")}</p>}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t("settings.reminder_label")}
                value={newReminder.label}
                onChange={(e) => setNewReminder(s => ({ ...s, label: e.target.value }))}
                className="max-w-xs"
              />
              <div className="relative max-w-36">
                <Input
                  type="number"
                  min={1}
                  placeholder="60"
                  value={newReminder.offset_minutes}
                  onChange={(e) => setNewReminder(s => ({ ...s, offset_minutes: e.target.value }))}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">min</span>
              </div>
              <Button
                onClick={() => {
                  createReminder.mutate(
                    { label: newReminder.label.trim(), offset_minutes: parseInt(newReminder.offset_minutes) },
                    { onSuccess: () => setNewReminder({ label: "", offset_minutes: "" }) },
                  );
                }}
                disabled={!newReminder.label.trim() || !newReminder.offset_minutes || createReminder.isPending}
              >
                {t("settings.add_reminder")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPermission("manage_system_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.clinic_confirmation")}</CardTitle>
            <CardDescription>{t("settings.clinic_confirmation_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings.clinic_confirmation_enabled")}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={((settings as Record<string, unknown>)?.clinic_confirmation_enabled ?? false) as boolean}
                onClick={() => update.mutate({ clinic_confirmation_enabled: !((settings as Record<string, unknown>)?.clinic_confirmation_enabled as boolean ?? false) })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  (settings as Record<string, unknown>)?.clinic_confirmation_enabled ? "bg-primary" : "bg-input"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  (settings as Record<string, unknown>)?.clinic_confirmation_enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
            <div className="space-y-1">
              <Label>{t("settings.clinic_confirmation_time")}</Label>
              <Input
                type="time"
                step="300"
                className="max-w-xs"
                value={((settings as Record<string, unknown>)?.clinic_confirmation_time as string) ?? "08:00"}
                onChange={(e) => update.mutate({ clinic_confirmation_time: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("settings.clinic_confirmation_time_hint")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPermission("manage_system_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.clinic_summary_emails")}</CardTitle>
            <CardDescription>{t("settings.clinic_summary_emails_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings.clinic_summary_emails_enabled")}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={((settings as Record<string, unknown>)?.clinic_summary_emails_enabled ?? false) as boolean}
                onClick={() => update.mutate({ clinic_summary_emails_enabled: !((settings as Record<string, unknown>)?.clinic_summary_emails_enabled as boolean ?? false) })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  (settings as Record<string, unknown>)?.clinic_summary_emails_enabled ? "bg-primary" : "bg-input"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  (settings as Record<string, unknown>)?.clinic_summary_emails_enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
            <div className="space-y-1">
              <Label>{t("settings.clinic_summary_emails_time")}</Label>
              <Input
                type="time"
                step="300"
                className="max-w-xs"
                value={((settings as Record<string, unknown>)?.clinic_summary_emails_time as string) ?? "08:00"}
                onChange={(e) => update.mutate({ clinic_summary_emails_time: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("settings.clinic_confirmation_time_hint")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPermission("manage_system_settings") && (
        <Card>
          <CardHeader><CardTitle>{t("settings.super_admin_options")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">

            {/* Timezone */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("settings.timezone")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.timezone_description")}</p>
              <select
                className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.timezone}
                onChange={(e) => setForm(s => ({ ...s, timezone: e.target.value }))}
              >
                <optgroup label="United States">
                  <option value="America/Los_Angeles">Pacific — Los Angeles (PT)</option>
                  <option value="America/Denver">Mountain — Denver (MT)</option>
                  <option value="America/Phoenix">Mountain (no DST) — Phoenix</option>
                  <option value="America/Chicago">Central — Chicago (CT)</option>
                  <option value="America/New_York">Eastern — New York (ET)</option>
                  <option value="America/Anchorage">Alaska — Anchorage (AKT)</option>
                  <option value="Pacific/Honolulu">Hawaii — Honolulu (HT)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="UTC">UTC</option>
                  <option value="America/Puerto_Rico">Puerto Rico (AST)</option>
                  <option value="America/Mexico_City">Mexico City (CST)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                </optgroup>
              </select>
              <p className="text-xs text-muted-foreground">
                {t("settings.timezone_current")}: <span className="font-medium">{new Date().toLocaleString([], { timeZone: form.timezone, timeZoneName: "long" }).split(", ").pop()}</span>
              </p>
            </div>

            <div className="border-t" />

            {/* Allow manual confirm */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings.allow_manual_confirm")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.allow_manual_confirm_description")}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={(settings as Record<string, unknown>)?.allow_manual_confirm as boolean ?? false}
                onClick={() => update.mutate({ allow_manual_confirm: !((settings as Record<string, unknown>)?.allow_manual_confirm as boolean ?? false) })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  (settings as Record<string, unknown>)?.allow_manual_confirm ? "bg-primary" : "bg-input"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  (settings as Record<string, unknown>)?.allow_manual_confirm ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* Long appointment alert threshold */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("settings.long_appointment_alert")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.long_appointment_alert_description")}</p>
              <div className="flex items-center gap-3">
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.long_appointment_alert_hours}
                    onChange={(e) => setForm(s => ({ ...s, long_appointment_alert_hours: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    {t("settings.hours_abbr")}
                  </span>
                </div>
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={form.long_appointment_alert_mins}
                    onChange={(e) => setForm(s => ({ ...s, long_appointment_alert_mins: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))}
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    {t("settings.mins_abbr")}
                  </span>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("settings.languages")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {languages.filter((l) => l.active).map((l) => (
              removingMode ? (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    const merged = languages.map((x) =>
                      x.code === l.code ? { code: x.code, name: x.name, active: false } : { code: x.code, name: x.name, active: x.active }
                    );
                    patchLanguages.mutate({ languages: merged });
                  }}
                  className="rounded-full border px-3 py-1 text-sm cursor-pointer animate-pulse shadow-[0_0_0_3px_hsl(var(--destructive)/0.3)] hover:bg-destructive/10 hover:shadow-[0_0_0_3px_hsl(var(--destructive)/0.6)] transition-all"
                >
                  {l.name}
                </button>
              ) : (
                <span key={l.code} className="rounded-full border px-3 py-1 text-sm">{l.name}</span>
              )
            ))}
          </div>
          <div className="flex gap-2">
            {!removingMode && (
              <>
                <Input placeholder={t("settings.new_language")} value={newLang.name} onChange={(e) => setNewLang(s => ({ ...s, name: e.target.value, code: e.target.value.trim().toLowerCase().slice(0, 10).replace(/\s+/g, "_") }))} className="max-w-xs" />
                <Button onClick={addLanguage} disabled={!newLang.name.trim() || patchLanguages.isPending}>{t("common.add")}</Button>
              </>
            )}
            {canRemoveLanguages && (
              <Button onClick={() => setRemovingMode((v) => !v)}>
                {removingMode ? t("settings.languages_done") : t("settings.remove_languages")}
              </Button>
            )}
          </div>
          {hasPermission("manage_system_settings") && (
            <div className="border-t pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings.show_language")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.show_language_description")}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={((settings as Record<string, unknown>)?.show_language ?? true) as boolean}
                onClick={() => update.mutate({ show_language: !(((settings as Record<string, unknown>)?.show_language) ?? true) })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  ((settings as Record<string, unknown>)?.show_language ?? true) ? "bg-primary" : "bg-input"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  ((settings as Record<string, unknown>)?.show_language ?? true) ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {hasPermission("manage_system_settings") && <CsvImportCard />}
    </div>
  );
}
