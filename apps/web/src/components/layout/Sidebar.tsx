import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.js";
import { useUnreadMessageCount } from "../../hooks/useMessages.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { cn } from "../../lib/utils.js";
import {
  LayoutDashboard, Calendar, ClipboardList, Users, Building2,
  ShieldCheck, UserSquare2, BarChart3, MessageSquare, Mail,
  Settings, Receipt, Landmark, Menu, X, Bell,
  type LucideIcon,
} from "lucide-react";
import { useInvoiceStats } from "../../hooks/useInvoices.js";
import { useAlerts } from "../../hooks/useSettings.js";

function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
}

export function Sidebar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const unreadCount = useUnreadMessageCount();
  const canManageInvoices = hasPermission("manage_invoices");
  const { data: invoiceStats } = useInvoiceStats(canManageInvoices);
  const pendingInvoices = invoiceStats?.submitted_count ?? 0;
  const { data: alertsData } = useAlerts();
  const unreadAlerts = alertsData?.unread_count ?? 0;
  const now = useClock();
  const tz = useOrgTimezone();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer whenever the route changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const navItems: NavItem[] = [
    { label: t("nav.dashboard"), to: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.alerts"), to: "/alerts", icon: Bell },
    { label: t("nav.calendar"), to: "/calendar", icon: Calendar },
    { label: t("nav.appointments"), to: "/appointments", icon: ClipboardList, permission: "manage_appointments" },
    { label: t("nav.interpreters"), to: "/interpreters", icon: Users, permission: "manage_interpreters" },
    { label: t("nav.clinics"), to: "/clinics", icon: Building2, permission: "manage_clinics" },
    { label: t("nav.agencies"), to: "/agencies", icon: ShieldCheck, permission: "manage_clinics" },
    { label: t("nav.insurance_companies"), to: "/insurance-companies", icon: Landmark, permission: "manage_clinics" },
    { label: t("nav.patients"), to: "/patients", icon: UserSquare2, permission: "manage_appointments" },
    { label: t("nav.reports"), to: "/reports", icon: BarChart3, permission: "view_reports" },
    { label: t("nav.invoices"), to: "/invoices", icon: Receipt, permission: "manage_invoices" },
    { label: t("nav.messages"), to: "/messages", icon: MessageSquare },
    { label: t("nav.email_intake"), to: "/email-intake", icon: Mail, permission: "manage_appointments" },
    { label: t("nav.admin_users"), to: "/admin-users", icon: Users, permission: "manage_admin_users" },
    { label: t("nav.settings"), to: "/settings", icon: Settings, permission: "manage_system_settings" },
  ];

  const visible = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  // Shared sidebar body used by both desktop and mobile overlay
  const sidebarBody = (
    <>
      {/* Logo + clock */}
      <div className="border-b border-white/10">
        <div className="flex h-16 items-center gap-3 px-5">
          <img src="/fruta-dorada-illustrated3.png" alt="Dorada" className="h-9 w-9 rounded-full object-contain" />
          <span style={{ fontFamily: "PlanetComic, sans-serif", fontSize: "1.75rem" }} className="text-white">DORADA</span>
        </div>
        <div className="pb-3 -mt-1 text-center">
          <p className="text-xl font-semibold tabular-nums text-white leading-none">
            {formatInTz(now, { hour: "numeric", minute: "2-digit" }, tz)}
          </p>
          <p className="text-[11px] text-white/50 mt-0.5">
            {formatInTz(now, { weekday: "short", month: "short", day: "numeric" }, tz)} · PST
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-0.5",
                isActive
                  ? "bg-sidebar-active-bg text-sidebar-active-fg"
                  : "text-sidebar-muted-fg hover:bg-sidebar-hover-bg hover:text-white",
              )
            }
          >
            <div className="relative shrink-0">
              <item.icon className="h-4 w-4" />
              {item.to === "/alerts" && unreadAlerts > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
              {item.to === "/messages" && unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-500" />
              )}
              {item.to === "/invoices" && pendingInvoices > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-500" />
              )}
            </div>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Account */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => navigate("/account")}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-muted-fg transition-colors hover:bg-sidebar-hover-bg hover:text-white"
        >
          {user?.profile_picture_url ? (
            <img
              src={user.profile_picture_url}
              alt={user.name}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
              {initials}
            </span>
          )}
          <span className="truncate">{user?.name}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar — always visible ─────────────────────────────── */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar-bg">
        {sidebarBody}
      </aside>

      {/* ── Mobile: collapsed strip with hamburger ────────────────────────── */}
      <aside className="md:hidden flex w-12 flex-col bg-sidebar-bg shrink-0">
        <button
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="flex h-16 items-center justify-center text-white/70 hover:text-white transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </aside>

      {/* ── Mobile: full overlay drawer ───────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar-bg md:hidden">
            {/* Close button */}
            <button
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-white/70 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarBody}
          </aside>
        </>
      )}
    </>
  );
}
