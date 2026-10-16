import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, MessageSquare, Receipt, User } from "lucide-react";

const tabs = [
  { to: "/appointments", icon: Calendar, labelKey: "nav.appointments" },
  { to: "/availability", icon: Clock, labelKey: "nav.availability" },
  { to: "/messages", icon: MessageSquare, labelKey: "nav.messages" },
  { to: "/earnings", icon: Receipt, labelKey: "nav.earnings" },
  { to: "/profile", icon: User, labelKey: "nav.profile" },
];

export default function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar safe-top">
        <Outlet />
      </div>
      <nav className="flex-shrink-0 bg-surface border-t border-[var(--color-border)] safe-bottom">
        <div className="flex">
          {tabs.map(({ to, icon: Icon, labelKey }) => {
            const active = location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 text-xs transition-colors ${
                  active ? "text-forest font-semibold" : "text-[var(--color-text-muted)]"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span>{t(labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
