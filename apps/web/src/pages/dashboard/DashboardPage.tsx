import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAuthStore } from "../../store/auth.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { useInvoiceStats } from "../../hooks/useInvoices.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Calendar, Clock, AlertTriangle, Mail, ClipboardList, Receipt } from "lucide-react";

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
    queryFn: () => api.get<{ data: unknown[]; pagination: { total: number } }>(`/appointments?status=pending_offer&date_from=${todayStr}&limit=1`),
  });

  const { data: followUpDrafts } = useQuery({
    queryKey: ["follow-up-drafts", "pending"],
    queryFn: () => api.get<{ data: unknown[] }>("/appointments/follow-up-drafts?status=pending_review&limit=5"),
  });

  const { data: emailDrafts } = useQuery({
    queryKey: ["email-intake-drafts", "pending"],
    queryFn: () => api.get<{ data: unknown[] }>("/email-intake/drafts?status=pending_review&limit=5"),
  });

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
          <p className="text-3xl font-semibold tabular-nums">{formatInTz(now, { hour: "2-digit", minute: "2-digit" }, tz)}</p>
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
          value={pendingOffers?.pagination?.total ?? 0}
          href={`/appointments?status=pending_offer&date_from=${todayStr}`}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          label={t("dashboard.follow_up_drafts")}
          value={followUpDrafts?.data.length ?? 0}
          href="/appointments/follow-up-drafts"
        />
        <StatCard
          icon={<Mail className="h-5 w-5 text-blue-500" />}
          label={t("dashboard.email_drafts")}
          value={emailDrafts?.data.length ?? 0}
          href="/email-intake/drafts"
        />
        <StatCard
          icon={<Receipt className="h-5 w-5 text-orange-500" />}
          label={t("dashboard.pending_invoices")}
          value={invoiceStats?.submitted_count ?? 0}
          href="/invoices"
          permission="manage_invoices"
        />
      </div>

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
                              confirmed:     "bg-green-100 border-green-300 text-green-800",
                              pending_offer: "bg-yellow-100 border-yellow-300 text-yellow-800",
                              in_progress:   "bg-blue-100 border-blue-300 text-blue-800",
                              completed:     "bg-green-100 border-green-300 text-green-800",
                              cancelled:     "bg-red-100 border-red-300 text-red-800",
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.email_intake_queue")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!emailDrafts?.data.length ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.no_pending_emails")}</p>
          ) : (
            <ul className="space-y-2">
              {(emailDrafts.data as Array<Record<string, unknown>>).map((draft) => (
                <li key={draft.id as string} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">{draft.extracted_patient_name as string ?? t("common.unknown")}</p>
                    <p className="text-muted-foreground">PO: {draft.po_number as string ?? "—"}</p>
                  </div>
                  {draft.has_unresolved_fields && (
                    <Badge variant="warning">{t("email_intake.unresolved")}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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

function StatCard({ icon, label, value, href, permission }: { icon: React.ReactNode; label: string; value: number; href: string; permission?: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (permission && !hasPermission(permission)) return null;
  return (
    <Link to={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-full bg-muted p-2">{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
