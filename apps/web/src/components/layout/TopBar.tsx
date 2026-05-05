import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.js";
import { clearTokens } from "../../lib/api.js";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button.js";
import { LogOut } from "lucide-react";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export function TopBar() {
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    clearTokens();
    logout();
    navigate("/login");
  }

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b bg-card px-6">
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-sm"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        {t("nav.logout")}
      </Button>
    </header>
  );
}
