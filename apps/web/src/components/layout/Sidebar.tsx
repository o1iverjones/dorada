import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.js";
import { useUnreadMessageCount } from "../../hooks/useMessages.js";
import { cn } from "../../lib/utils.js";
import {
  LayoutDashboard, Calendar, ClipboardList, Users, Building2,
  ShieldCheck, UserSquare2, BarChart3, MessageSquare, Mail,
  Settings, User, Upload, Receipt,
} from "lucide-react";
import { useInvoiceStats } from "../../hooks/useInvoices.js";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

export function Sidebar() {
  const { t } = useTranslation();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const unreadCount = useUnreadMessageCount();
  const canManageInvoices = hasPermission("manage_invoices");
  const { data: invoiceStats } = useInvoiceStats(canManageInvoices);
  const pendingInvoices = invoiceStats?.submitted_count ?? 0;

  const navItems: NavItem[] = [
    { label: t("nav.dashboard"), to: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.calendar"), to: "/calendar", icon: Calendar },
    { label: t("nav.appointments"), to: "/appointments", icon: ClipboardList, permission: "manage_appointments" },
    { label: t("nav.interpreters"), to: "/interpreters", icon: Users, permission: "manage_interpreters" },
    { label: t("nav.clinics"), to: "/clinics", icon: Building2, permission: "manage_clinics" },
    { label: t("nav.insurance_agencies"), to: "/insurance-agencies", icon: ShieldCheck, permission: "manage_clinics" },
    { label: t("nav.patients"), to: "/patients", icon: UserSquare2, permission: "manage_appointments" },
    { label: t("nav.reports"), to: "/reports", icon: BarChart3, permission: "view_reports" },
    { label: t("nav.invoices"), to: "/invoices", icon: Receipt, permission: "manage_invoices" },
    { label: t("nav.messages"), to: "/messages", icon: MessageSquare },
    { label: t("nav.email_intake"), to: "/email-intake", icon: Mail, permission: "manage_appointments" },
    { label: t("nav.admin_users"), to: "/admin-users", icon: Users, permission: "manage_admin_users" },
    { label: t("nav.settings"), to: "/settings", icon: Settings, permission: "manage_system_settings" },
    { label: "CSV Import", to: "/import", icon: Upload, permission: "manage_interpreters" },
  ];

  const visible = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  return (
    <aside className="flex w-64 flex-col bg-sidebar-bg">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
        <img src="/dorada-logo-trans2.png" alt="Dorada" className="h-9 w-9 rounded-full object-contain" />
        <span style={{ fontFamily: "PlanetComic, sans-serif", fontSize: "1.75rem" }} className="text-white">DORADA</span>
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
        <NavLink
          to="/account"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-active-bg text-sidebar-active-fg"
                : "text-sidebar-muted-fg hover:bg-sidebar-hover-bg hover:text-white",
            )
          }
        >
          <User className="h-4 w-4" />
          <span className="truncate">{t("nav.account")}</span>
        </NavLink>
      </div>
    </aside>
  );
}
