import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useAuthStore } from "../../store/auth.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { toast } from "../../hooks/use-toast.js";
import { useTranslation as useI18n } from "react-i18next";

const NOTIFICATION_PREFS = ["immediate_push", "immediate_email", "digest_email", "queue_only"] as const;
const LOCALES = [{ code: "en", label: "English" }, { code: "es", label: "Español" }];

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [notifPref, setNotifPref] = useState("queue_only");
  const [emailIntakePref, setEmailIntakePref] = useState("queue_only");

  const updatePrefs = useMutation({
    mutationFn: (body: unknown) => api.patch("/admin-users/me/preferences", body),
    onSuccess: () => toast({ title: t("common.saved") }),
  });

  const changePassword = useMutation({
    mutationFn: (body: unknown) => api.post("/auth/admin/password-reset/confirm", body),
    onSuccess: () => toast({ title: t("account.password_changed") }),
  });

  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });

  async function handleSavePrefs() {
    await updatePrefs.mutateAsync({
      follow_up_notification: notifPref,
      email_intake_notification: emailIntakePref,
      locale: i18n.language,
    });
  }

  async function handleChangePassword() {
    if (pwForm.new_password !== pwForm.confirm) {
      toast({ title: t("account.passwords_mismatch"), variant: "destructive" });
      return;
    }
    await changePassword.mutateAsync({ current_password: pwForm.current_password, new_password: pwForm.new_password });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("account.title")} />

      <Card>
        <CardHeader><CardTitle>{t("account.profile")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("account.name")}</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("account.email")}</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("account.role")}</span><span className="font-medium">{user?.role}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("account.preferences")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t("account.language")}</Label>
            <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("account.follow_up_notification")}</Label>
            <Select value={notifPref} onValueChange={setNotifPref}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTIFICATION_PREFS.map((p) => <SelectItem key={p} value={p}>{t(`account.notif_${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("account.email_intake_notification")}</Label>
            <Select value={emailIntakePref} onValueChange={setEmailIntakePref}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTIFICATION_PREFS.map((p) => <SelectItem key={p} value={p}>{t(`account.notif_${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSavePrefs} disabled={updatePrefs.isPending}>{t("common.save_changes")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("account.change_password")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>{t("account.current_password")}</Label>
            <Input type="password" value={pwForm.current_password} onChange={(e) => setPwForm(s => ({ ...s, current_password: e.target.value }))} className="max-w-sm" />
          </div>
          <div className="space-y-1">
            <Label>{t("account.new_password")}</Label>
            <Input type="password" value={pwForm.new_password} onChange={(e) => setPwForm(s => ({ ...s, new_password: e.target.value }))} className="max-w-sm" />
          </div>
          <div className="space-y-1">
            <Label>{t("account.confirm_password")}</Label>
            <Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm(s => ({ ...s, confirm: e.target.value }))} className="max-w-sm" />
          </div>
          <Button onClick={handleChangePassword} disabled={changePassword.isPending || !pwForm.current_password || !pwForm.new_password}>
            {t("account.change_password")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
