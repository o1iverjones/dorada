import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Camera, LogOut, User } from "lucide-react";
import { api, clearTokens } from "../../lib/api.js";
import { useAuthStore } from "../../store/auth.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Label } from "../../components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { toast } from "../../hooks/use-toast.js";

const NOTIFICATION_PREFS = ["immediate_push", "immediate_email", "digest_email", "queue_only"] as const;
const LOCALES = [{ code: "en", label: "English" }, { code: "es", label: "Español" }];

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phone_ext: string | null;
  profile_picture_url: string | null;
}

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch full profile from server (has phone etc.)
  const { data: profile } = useQuery<ProfileData>({
    queryKey: ["admin-me"],
    queryFn: () => api.get<ProfileData>("/admin-users/me"),
  });

  const [nameForm, setNameForm] = useState({ name: "" });
  const [phoneForm, setPhoneForm] = useState({ phone: "", phone_ext: "" });

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      setNameForm({ name: profile.name });
      setPhoneForm({ phone: profile.phone ?? "", phone_ext: profile.phone_ext ?? "" });
    }
  }, [profile]);

  const [notifPref, setNotifPref] = useState("queue_only");
  const [emailIntakePref, setEmailIntakePref] = useState("queue_only");
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });

  const updateProfile = useMutation({
    mutationFn: (body: { name?: string; phone?: string | null; phone_ext?: string | null }) =>
      api.patch<ProfileData>("/admin-users/me/profile", body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["admin-me"] });
      // Sync the auth store so avatar/name in TopBar updates immediately
      if (user) setUser({ ...user, name: updated.name, phone: updated.phone, phone_ext: updated.phone_ext });
      toast({ title: t("common.saved") });
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile<{ id: string; profile_picture_url: string }>("/admin-users/me/avatar", fd);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["admin-me"] });
      if (user) setUser({ ...user, profile_picture_url: updated.profile_picture_url });
      toast({ title: t("account.avatar_updated") });
    },
  });

  const updatePrefs = useMutation({
    mutationFn: (body: unknown) => api.patch("/admin-users/me/preferences", body),
    onSuccess: () => toast({ title: t("common.saved") }),
  });

  const changePassword = useMutation({
    mutationFn: (body: unknown) => api.post("/auth/admin/password-reset/confirm", body),
    onSuccess: () => {
      toast({ title: t("account.password_changed") });
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    },
  });

  function handleLogout() {
    clearTokens();
    logout();
    navigate("/login");
  }

  async function handleSaveProfile() {
    await updateProfile.mutateAsync({
      name: nameForm.name || undefined,
      phone: phoneForm.phone || null,
      phone_ext: phoneForm.phone_ext || null,
    });
  }

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

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAvatar.mutate(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  const displayPicture = profile?.profile_picture_url ?? user?.profile_picture_url;
  const displayName = profile?.name ?? user?.name ?? "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <PageHeader title={t("account.title")} />

      {/* Profile card */}
      <Card>
        <CardHeader><CardTitle>{t("account.profile")}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              {displayPicture ? (
                <img
                  src={displayPicture}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover border"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground border">
                  {initials || <User className="h-8 w-8" />}
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadAvatar.isPending}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors"
                title={t("account.change_avatar")}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-base">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile?.email ?? user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>

          {/* Editable name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("account.name")}</Label>
              <Input
                value={nameForm.name}
                onChange={(e) => setNameForm({ name: e.target.value })}
                className="max-w-sm"
              />
            </div>
          </div>

          {/* Phone + extension */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("account.phone")}</Label>
              <Input
                type="tel"
                placeholder="(555) 000-0000"
                value={phoneForm.phone}
                onChange={(e) => setPhoneForm((s) => ({ ...s, phone: e.target.value }))}
                className="max-w-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("account.phone_ext")}</Label>
              <Input
                placeholder="123"
                value={phoneForm.phone_ext}
                onChange={(e) => setPhoneForm((s) => ({ ...s, phone_ext: e.target.value }))}
                className="max-w-[120px]"
              />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
            {t("common.save_changes")}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
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

      {/* Change password */}
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

      {/* Sign out */}
      <Card>
        <CardHeader><CardTitle>{t("account.session")}</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("nav.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
