import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAuthStore } from "../../store/auth.js";
import { useOrgTimezone, useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { useInvoiceStats } from "../../hooks/useInvoices.js";
import { getSocket } from "../../lib/socket.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Calendar, Clock, AlertTriangle, Bell, ClipboardList, Receipt, CheckCheck } from "lucide-react";

function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const now = useClock();
  const tz = useOrgTimezone();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  const { data: todayAppts, isLoading } = useQuery({
    queryKey: ["appointments", "today", todayStr],
    queryFn: () =>
      api.get<{ data: unknown[] }>(`/appointments?date_from=${todayStr}&date_to=${todayStr}&limit=20`),
  });

  const { data: pendingOffers } = useQuery({
    queryKey: ["appointments", "pending_offer", todayStr],
    queryFn: () => api.get<{ data: unknown[] }>(`/appointments?status=pending_offer&date_from=${todayStr}&limit=500`),
  });

  const { data: followUpDrafts } = useQuery({
    queryKey: ["follow-up-drafts", "pending"],
    queryFn: () => api.get<{ data: unknown[] }>("/appointments/follow-up-drafts?status=pending_review&limit=5"),
  });

  const { data: alertsData, refetch: refetchAlerts } = useAlerts();
  const markAlertRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const allAlerts = (alertsData?.data ?? []) as Array<Record<string, unknown>>;
  // Stat card: total unread across all time
  const unreadCount = alertsData?.unread_count ?? 0;
  // Dashboard panel: today's alerts only, capped at 3
  const todayAlerts = allAlerts.filter((a) => {
    const alertDate = new Date(a.created_at as string).toLocaleDateString("en-CA", { timeZone: tz });
    return alertDate === todayStr;
  });
  const alerts = todayAlerts.slice(0, 3);
  const hasMore = todayAlerts.length > 3;
  const qc = useQueryClient();

  // Real-time: refetch alerts when a new one arrives via socket
  useEffect(() => {
    const socket = getSocket();
    const handler = () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    };
    socket.on("alert:new", handler);
    return () => { socket.off("alert:new", handler); };
  }, [qc]);

  const canManageInvoices = useAuthStore((s) => s.hasPermission("manage_invoices"));
  const { data: invoiceStats } = useInvoiceStats(canManageInvoices);

  const { data: activityLog } = useQuery({
    queryKey: ["activity-log"],
    queryFn: () => api.get<unknown[]>("/appointments/activity?limit=50"),
  });

  const [logTooltip, setLogTooltip] = useState<{ entry: Record<string, unknown>; x: number; y: number } | null>(null);
  const logTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logMousePos = useRef({ x: 0, y: 0 });

  const startLogTooltip = useCallback((entry: Record<string, unknown>) => {
    if (logTooltipTimer.current) clearTimeout(logTooltipTimer.current);
    logTooltipTimer.current = setTimeout(() => {
      setLogTooltip({ entry, x: logMousePos.current.x, y: logMousePos.current.y });
    }, 500);
  }, []);

  const clearLogTooltip = useCallback(() => {
    if (logTooltipTimer.current) clearTimeout(logTooltipTimer.current);
    setLogTooltip(null);
  }, []);

  const trackLogMouse = useCallback((e: React.MouseEvent) => {
    logMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.welcome", { name: user?.name })}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">{formatInTz(now, { hour: "numeric", minute: "2-digit" }, tz)}</p>
          <p className="text-sm text-muted-foreground">(PST) {formatInTz(now, { weekday: "long", month: "long", day: "numeric" }, tz)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Calendar className="h-5 w-5 text-primary" />}
          label={t("dashboard.todays_appointments")}
          value={todayAppts?.data.length ?? 0}
          href={`/appointments?date_from=${todayStr}&status=`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          label={t("dashboard.pending_offers")}
          value={pendingOffers?.data.length ?? 0}
          href={`/appointments?status=pending_offer&date_from=${todayStr}`}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          label={t("dashboard.follow_up_drafts")}
          value={followUpDrafts?.data.length ?? 0}
          href="/appointments/follow-up-drafts"
        />
        <StatCard
          icon={<Bell className={`h-5 w-5 ${unreadCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />}
          label={t("dashboard.alerts")}
          value={unreadCount}
          href="/alerts"
          highlight={unreadCount > 0}
        />
        <StatCard
          icon={<Receipt className="h-5 w-5 text-orange-500" />}
          label={t("dashboard.pending_invoices")}
          value={invoiceStats?.submitted_count ?? 0}
          href="/invoices"
          permission="manage_invoices"
        />
      </div>

      <Card id="alerts">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            {t("dashboard.alerts")}
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">{unreadCount}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            {alerts.length > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("dashboard.mark_all_read")}
              </button>
            )}
            <Link to="/alerts" className="text-xs font-medium text-primary hover:underline">
              {t("dashboard.view_all")}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!alerts.length ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.no_alerts")}</p>
          ) : (
            <>
              <ul className="space-y-2">
                {alerts.map((alert) => {
                  const isUnread = !alert.is_read;
                  const apptId = alert.appointment_id as string | null;
                  return (
                    <li
                      key={alert.id as string}
                      className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm transition-colors ${isUnread ? "bg-red-50 border-red-200" : "bg-muted/30"}`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${isUnread ? "text-red-500" : "text-muted-foreground"}`} />
                        <div className="min-w-0">
                          <p className={`leading-snug ${isUnread ? "font-medium" : "text-muted-foreground"}`}>
                            {alert.message as string}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatInTz(alert.created_at as string, { dateStyle: "short", timeStyle: "short" }, tz)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {apptId && (
                          <Link
                            to={`/appointments/${apptId}`}
                            className="text-xs font-bold text-primary hover:underline whitespace-nowrap"
                          >
                            {t("dashboard.view_appointment")}
                          </Link>
                        )}
                        {isUnread && (
                          <button
                            onClick={() => markAlertRead.mutate(alert.id as string)}
                            className="text-muted-foreground hover:text-foreground"
                            title={t("dashboard.mark_read")}
                          >
                            <CheckCheck className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <div className="mt-3 text-center">
                  <Link to="/alerts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {t("dashboard.view_all_alerts", { count: todayAlerts.length })}
                  </Link>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.todays_schedule")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : !todayAppts?.data.length ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.no_appointments_today")}</p>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex items-center gap-3 px-[1em] pb-1.5 mb-1 border-b text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="flex-[2]">Patient / PO</span>
                  <span className="flex-[2]">Interpreter</span>
                  <span className="flex-[1.5]">Agency</span>
                  <span className="flex-1 text-center">Clock In/Out</span>
                  <span className="flex-1 text-center">Scheduled</span>
                  <span className="w-20">Status</span>
                  <span className="w-14">Approve</span>
                </div>
                <ul className="space-y-[1em]">
                {(todayAppts.data as Array<Record<string, unknown>>).map((appt) => {
                  const dt = new Date(appt.date_time as string);
                  const endDt = new Date(dt.getTime() + (appt.duration_minutes as number) * 60000);
                  const scheduledTime = formatInTz(dt, { hour: "2-digit", minute: "2-digit" }, tz)
                    + " – " + formatInTz(endDt, { hour: "2-digit", minute: "2-digit" }, tz);

                  const patientName = (appt.patient as Record<string, unknown>)?.name as string ?? "—";
                  const poNumber = appt.po_number as string | null;

                  const interp = appt.interpreter as Record<string, unknown> | null;
                  const interpName = interp?.name as string | undefined;
                  const interpAvatar = interp?.profile_picture_url as string | null | undefined;
                  const interpInitials = interpName
                    ? interpName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
                    : null;
                  // Pay rate: appointment-level first, then interpreter-level
                  const rawRate = (appt.pay_rate ?? interp?.pay_rate) as string | number | null | undefined;
                  const payRate = rawRate != null ? `$${Number(rawRate).toFixed(2)}/hr` : null;

                  const agencyName = (appt.insurance_agency as Record<string, unknown>)?.name as string | null;

                  const clockIn = appt.clock_in_time
                    ? formatInTz(appt.clock_in_time as string, { hour: "2-digit", minute: "2-digit" }, tz)
                    : null;
                  const clockOut = appt.clock_out_time
                    ? formatInTz(appt.clock_out_time as string, { hour: "2-digit", minute: "2-digit" }, tz)
                    : null;

                  const status = appt.status as string;
                  const isPendingOffer = status === "pending_offer";
                  const hasClockOut = !!appt.clock_out_time;
                  const invoice = appt.invoice as Record<string, unknown> | null | undefined;
                  const invoiceHref = invoice?.id ? `/invoices` : `/invoices`;
                  const actualMins = appt.actual_duration_minutes as number | null;
                  const isLongAppt = actualMins != null && actualMins > 120;
                  const distMiles = appt.clock_in_distance_miles as number | null;
                  const isFarClockIn = distMiles != null && distMiles > 1;

                  return (
                    <li key={appt.id as string} className="rounded-md border p-[1em]">
                      <div className="flex items-center gap-3 text-sm min-w-0">

                        {/* Patient */}
                        <Link to={`/appointments/${appt.id as string}`} className="flex-[2] min-w-0 hover:underline">
                          <p className="font-bold truncate">{patientName}</p>
                          <p className="text-xs text-muted-foreground">PO: {poNumber ?? "—"}</p>
                        </Link>

                        {/* Interpreter */}
                        <div className="flex-[2] flex items-center gap-2 min-w-0">
                          {interp ? (
                            <>
                              <div className="shrink-0 h-7 w-7 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                {interpAvatar
                                  ? <img src={interpAvatar} alt={interpName} className="h-full w-full object-cover" />
                                  : interpInitials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{interpName}</p>
                                {payRate && <p className="text-[11px] text-muted-foreground">{payRate}</p>}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t("appointments.unassigned")}</span>
                          )}
                        </div>

                        {/* Agency */}
                        <div className="flex-[1.5] min-w-0">
                          <p className="text-xs font-bold truncate">{agencyName ?? "—"}</p>
                        </div>

                        {/* Clock times */}
                        <div className="flex-1 shrink-0 text-center">
                          <p className="text-xs font-medium tabular-nums">{clockIn ?? "—"}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{clockOut ?? "—"}</p>
                        </div>

                        {/* Scheduled time */}
                        <div className="flex-1 shrink-0 text-center">
                          <p className="text-xs font-medium tabular-nums whitespace-nowrap">{scheduledTime}</p>
                          <p className="text-[11px] text-muted-foreground">scheduled</p>
                        </div>

                        {/* Flags */}
                        <div className="flex w-20 shrink-0 items-center gap-1 flex-wrap">
                          {(() => {
                            const statusColors: Record<string, string> = {
                              unassigned:    "bg-gray-100 border-gray-300 text-gray-500",
                              confirmed:     "bg-green-100 border-green-300 text-green-800",
                              pending_offer: "bg-yellow-100 border-yellow-300 text-yellow-800",
                              in_progress:   "bg-blue-100 border-blue-300 text-blue-800",
                              completed:     "bg-green-100 border-green-300 text-green-800",
                              cancelled:     "bg-red-100 border-red-300 text-red-800",
                              declined:      "bg-gray-100 border-red-400 text-red-700",
                            };
                            const colorClass = statusColors[status] ?? "bg-muted border-gray-300 text-muted-foreground";
                            return (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize whitespace-nowrap ${colorClass}`}>
                                {status.replace(/_/g, " ")}
                              </Badge>
                            );
                          })()}
                          {isLongAppt && (
                            <Badge
                              variant="outline"
                              title={`Actual duration: ${actualMins} min — exceeds 2-hour standard`}
                              className="text-[10px] px-1.5 py-0 whitespace-nowrap bg-amber-50 border-amber-400 text-amber-700 gap-0.5"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {`>${Math.floor(actualMins! / 60)}h`}
                            </Badge>
                          )}
                          {isFarClockIn && (
                            <Badge
                              variant="outline"
                              title={`Clocked in ${distMiles!.toFixed(2)} mi from clinic — exceeds 1-mile limit`}
                              className="text-[10px] px-1.5 py-0 whitespace-nowrap bg-red-50 border-red-400 text-red-700 gap-0.5"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {`${distMiles!.toFixed(1)}mi`}
                            </Badge>
                          )}
                        </div>

                        {/* Approve button */}
                        <Link
                          to={invoiceHref}
                          onClick={(e) => !hasClockOut && e.preventDefault()}
                          className={`shrink-0 w-14 inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap
                            ${hasClockOut
                              ? "border-green-600 bg-green-50 text-green-700 hover:bg-green-100"
                              : "border-border text-muted-foreground cursor-not-allowed opacity-40 pointer-events-none"}`}
                        >
                          Approve
                        </Link>
                      </div>
                    </li>
                  );
                })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" /> {t("dashboard.activity_log")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            {!(activityLog as Array<Record<string, unknown>> | undefined)?.length ? (
              <p className="text-sm text-muted-foreground">{t("appointments.no_activity")}</p>
            ) : (
              <ol className="divide-y">
                {(activityLog as Array<Record<string, unknown>>).map((entry) => {
                  const entityType = entry.entity_type as string;
                  const entityId = entry.entity_id as string;
                  const entityName = entry.entity_name as string | null;
                  const action = entry.action as string;
                  const poNumber = entry.po_number as string | null;
                  const linkTo = entityType === "appointment" ? `/appointments/${entityId}`
                    : entityType === "clinic" ? `/clinics/${entityId}`
                    : entityType === "interpreter" ? `/interpreters/${entityId}`
                    : entityType === "agency" ? `/insurance-agencies/${entityId}`
                    : entityType === "admin_user" ? `/admin-users`
                    : null;
                  const meta = [
                    poNumber ? `PO: ${poNumber}` : "PO: —",
                    formatInTz(entry.created_at as string, { dateStyle: "short", timeStyle: "short" }, tz),
                    entry.detail as string | null,
                  ].filter(Boolean).join(" · ");

                  // For note_added entries, show patient name as an appointment link on its own line.
                  const isNoteAdded = action === "note_added";

                  return (
                    <li
                      key={entry.id as string}
                      className="py-2 cursor-default"
                      onMouseEnter={() => startLogTooltip(entry)}
                      onMouseLeave={clearLogTooltip}
                      onMouseMove={trackLogMouse}
                    >
                      <p className="text-xs font-medium leading-snug truncate">
                        {entry.admin_name as string}
                        {" — "}
                        <span className="capitalize font-normal">{action.replace(/_/g, " ")}</span>
                        {!isNoteAdded && entityName && (
                          <>
                            {" "}
                            {linkTo ? (
                              <Link to={linkTo} className="text-primary hover:underline">{entityName}</Link>
                            ) : (
                              <span className="text-muted-foreground">{entityName}</span>
                            )}
                          </>
                        )}
                      </p>
                      {isNoteAdded && entityName && linkTo && (
                        <p className="text-xs truncate mt-0.5">
                          <Link to={linkTo} className="text-primary font-medium hover:underline">{entityName}</Link>
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{meta}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {logTooltip && (
        <ActivityLogTooltip entry={logTooltip.entry} x={logTooltip.x} y={logTooltip.y} />
      )}
    </div>
  );
}

function ActivityLogTooltip({ entry: e, x, y }: { entry: Record<string, unknown>; x: number; y: number }) {
  const { t } = useTranslation();
  const tz = useOrgTimezone();

  const entityType = e.entity_type as string;
  const entityName = e.entity_name as string | null;
  const action = (e.action as string).replace(/_/g, " ");
  const poNumber = e.po_number as string | null;
  const detail = e.detail as string | null;
  const adminName = e.admin_name as string;
  const entityLabel = entityType === "appointment" ? t("nav.appointments")
    : entityType === "clinic" ? t("nav.clinics")
    : entityType === "interpreter" ? t("nav.interpreters")
    : entityType === "agency" ? t("nav.insuranceAgencies")
    : entityType === "admin_user" ? t("nav.admin_users")
    : entityType;

  const flipLeft = x + 280 > window.innerWidth;
  const flipUp = y + 260 > window.innerHeight;

  return (
    <div
      className="fixed z-50 w-64 rounded-lg border bg-popover shadow-lg text-sm"
      style={{
        left: flipLeft ? x - 272 : x + 12,
        top: flipUp ? y - 8 : y + 12,
        pointerEvents: "none",
      }}
    >
      <div className="border-b px-3 py-2">
        <p className="font-semibold capitalize">{action}</p>
        <p className="text-xs text-muted-foreground">{adminName}</p>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {entityName && <LogRow label={entityLabel} value={entityName} />}
        <LogRow label={t("appointments.po_number")} value={poNumber ?? "—"} />
        <LogRow label={t("appointments.date_time")} value={formatInTz(e.created_at as string, { dateStyle: "medium", timeStyle: "short" }, tz)} />
        {detail && <LogRow label="Detail" value={detail} />}
      </div>
    </div>
  );
}

function LogRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function StatCard({ icon, label, value, href, permission, highlight }: { icon: React.ReactNode; label: string; value: number; href: string; permission?: string; highlight?: boolean }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (permission && !hasPermission(permission)) return null;
  const inner = (
    <Card className={`transition-shadow hover:shadow-md ${highlight ? "border-red-300 bg-red-50" : ""}`}>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-full p-2 ${highlight ? "bg-red-100" : "bg-muted"}`}>{icon}</div>
        <div>
          <p className={`text-2xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  // Alerts card scrolls to the panel rather than navigating
  if (href.startsWith("#")) {
    return <a href={href} onClick={(e) => { e.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); }}>{inner}</a>;
  }
  return <Link to={href}>{inner}</Link>;
}
