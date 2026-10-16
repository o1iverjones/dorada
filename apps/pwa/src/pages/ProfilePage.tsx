import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Globe, Bell, BellOff } from "lucide-react";
import { api, clearTokens } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { usePushNotifications } from "../hooks/usePushNotifications";

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { interpreter, logout } = useAuthStore();

  const { data } = useQuery({
    queryKey: ["interpreter-profile"],
    queryFn: () => api.get<Record<string, unknown>>("/interpreters/me"),
  });

  const profile = data as Record<string, unknown> | undefined;
  const { permission, subscribed, supported, subscribe, unsubscribe } = usePushNotifications();

  function handleLogout() {
    if (!confirm(t("account.logout_confirm_body"))) return;
    clearTokens();
    logout();
    navigate("/login", { replace: true });
  }

  function toggleLang() {
    const next = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(next);
    localStorage.setItem("dorada-pwa-lang", next);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center pt-6 pb-2">
          <div className="w-20 h-20 rounded-full bg-forest flex items-center justify-center mb-3">
            <span className="text-white text-2xl font-bold">{interpreter?.name?.slice(0, 2).toUpperCase() ?? "??"}</span>
          </div>
          <p className="text-xl font-bold">{interpreter?.name ?? "—"}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{interpreter?.phone ?? "—"}</p>
        </div>

        {/* Profile info */}
        {profile && (
          <div className="bg-surface rounded-xl divide-y divide-[var(--color-border)]">
            <Row label={t("interpreters.type")} value={(profile.type as string) ?? "—"} />
            <Row label={t("interpreters.languages")} value={((profile.languages as string[]) ?? []).join(", ")} />
            <Row label={t("interpreters.email")} value={(profile.email as string) ?? "—"} />
          </div>
        )}

        {/* Push notifications */}
        {supported && (
          <button
            onClick={subscribed ? unsubscribe : subscribe}
            className={`w-full flex items-center justify-center gap-2 bg-surface rounded-xl py-3.5 border text-sm font-semibold active:bg-gray-50 ${
              subscribed
                ? "border-green-200 text-green-700"
                : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
            disabled={permission === "denied"}
          >
            {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
            {permission === "denied"
              ? "Notifications blocked in browser settings"
              : subscribed
                ? "Notifications enabled"
                : "Enable notifications"}
          </button>
        )}

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="w-full flex items-center justify-center gap-2 bg-surface rounded-xl py-3.5 border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-muted)] active:bg-gray-50"
        >
          <Globe size={18} />
          {i18n.language === "es" ? "Switch to English" : "Cambiar a Español"}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-surface rounded-xl py-3.5 border border-red-200 text-red-600 text-sm font-semibold active:bg-red-50"
        >
          <LogOut size={18} />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <span className="text-sm font-medium text-right flex-1 ml-4">{value}</span>
    </div>
  );
}
