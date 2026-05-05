import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSystemSettings, useUpdateSystemSettings } from "../../hooks/useSettings.js";
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

interface Language { id?: string; code: string; name: string; active: boolean; }
interface AppointmentType { id: string; name: string; pay_model: string; minimum_billable_minutes: number; is_active: boolean; }

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSystemSettings();
  const update = useUpdateSystemSettings();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    default_certified_rate: 0,
    default_qualified_rate: 0,
    follow_up_reminder_window_minutes: 60,
    follow_up_max_reminders: 2,
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
            {languages.map((l) => (
              <span key={l.code} className={`rounded-full border px-3 py-1 text-sm ${l.active ? "" : "opacity-50"}`}>{l.name}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder={t("settings.languages.code")} value={newLang.code} onChange={(e) => setNewLang(s => ({ ...s, code: e.target.value }))} className="max-w-24" maxLength={10} />
            <Input placeholder={t("settings.new_language")} value={newLang.name} onChange={(e) => setNewLang(s => ({ ...s, name: e.target.value }))} className="max-w-xs" />
            <Button onClick={addLanguage} disabled={!newLang.code.trim() || !newLang.name.trim() || patchLanguages.isPending}>{t("common.add")}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.appointment_types")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {types.map((ty) => (
              <div key={ty.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{ty.name}</span>
                <div className="flex gap-4 text-muted-foreground">
                  <span>{ty.pay_model}</span>
                  <span>{(ty.minimum_billable_minutes / 60).toFixed(1)}h min</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder={t("settings.type_name")} value={newType.name} onChange={(e) => setNewType(s => ({ ...s, name: e.target.value }))} />
            <select className="rounded-md border p-2 text-sm" value={newType.pay_model} onChange={(e) => setNewType(s => ({ ...s, pay_model: e.target.value }))}>
              <option value="hourly">{t("settings.hourly")}</option>
              <option value="flat_rate">{t("settings.flat_rate")}</option>
            </select>
            <Input type="number" min={0.5} step={0.5} value={newType.minimum_billable_hours} onChange={(e) => setNewType(s => ({ ...s, minimum_billable_hours: parseFloat(e.target.value) }))} />
          </div>
          <Button onClick={addType} disabled={!newType.name || createType.isPending}>{t("settings.add_type")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
