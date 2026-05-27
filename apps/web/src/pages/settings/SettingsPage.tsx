import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSystemSettings, useUpdateSystemSettings, useInterpreterRates, useUpdateAppointmentType, useDeleteAppointmentType } from "../../hooks/useSettings.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { toast } from "../../hooks/use-toast.js";
import { useNavigate } from "react-router-dom";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { useAuthStore } from "../../store/auth.js";

interface Language { id?: string; code: string; name: string; active: boolean; }
interface AppointmentType { id: string; name: string; pay_model: string; minimum_billable_minutes: number; is_active: boolean; }

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
  });

  useEffect(() => {
    if (settings) {
      const s = settings as Record<string, unknown>;
      const rates = s.default_pay_rates as Record<string, number> | undefined;
      const followUp = s.follow_up_config as Record<string, number> | undefined;
      setForm({
        default_certified_rate: rates?.certified ?? 0,
        default_qualified_rate: rates?.qualified ?? 0,
        follow_up_reminder_window_minutes: followUp?.non_response_window_minutes ?? 60,
        follow_up_max_reminders: followUp?.max_reminders ?? 2,
        timezone: (s.timezone as string) ?? "America/Los_Angeles",
      });
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

      <Card>
        <CardHeader><CardTitle>{t("settings.timezone")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("settings.timezone_description")}</p>
          <select
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.timezone}
            onChange={(e) => setForm(s => ({ ...s, timezone: e.target.value }))}
          >
            <optgroup label="United States">
              <option value="America/New_York">Eastern — New York (ET)</option>
              <option value="America/Chicago">Central — Chicago (CT)</option>
              <option value="America/Denver">Mountain — Denver (MT)</option>
              <option value="America/Phoenix">Mountain (no DST) — Phoenix</option>
              <option value="America/Los_Angeles">Pacific — Los Angeles (PT)</option>
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
        </CardContent>
      </Card>

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
        </CardContent>
      </Card>

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

      {hasPermission("manage_system_settings") && (
        <Card>
          <CardHeader><CardTitle>{t("settings.super_admin_options")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
