import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { useClinics } from "../../hooks/useClinics.js";
import { useOrgTimezone, useShowLanguage } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { AutocompleteInput } from "../../components/shared/AutocompleteInput.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Button } from "../../components/ui/button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { ChevronLeft, ChevronRight, Plus, CalendarOff, CalendarDays } from "lucide-react";
import { api } from "../../lib/api.js";

type View = "month" | "week" | "day";

const STATUS_COLORS: Record<string, string> = {
  unassigned: "bg-gray-100 border-gray-300 text-gray-500",
  confirmed: "bg-green-100 border-green-300 text-green-800",
  pending_offer: "bg-yellow-100 border-yellow-300 text-yellow-800",
  in_progress: "bg-green-100 border-green-300 text-blue-800",
  completed: "bg-green-100 border-green-300 text-green-800",
  cancelled: "bg-red-100 border-red-300 text-red-800",
  declined: "bg-gray-100 border-red-400 text-red-700",
};

const BLOCK_COLORS = [
  "bg-purple-200 border-purple-400 text-purple-900",
  "bg-pink-200 border-pink-400 text-pink-900",
  "bg-orange-200 border-orange-400 text-orange-900",
  "bg-teal-200 border-teal-400 text-teal-900",
  "bg-indigo-200 border-indigo-400 text-indigo-900",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function startOfWeek(d: Date, tz: string): Date {
  // Find the most-recent Monday in the org timezone.
  // Using browser-local getDay() would give wrong results when the browser
  // timezone differs from the org timezone.
  const dowStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[dowStr] ?? 1;
  const daysBack = dow === 0 ? 6 : dow - 1; // Mon→0, Tue→1, …, Sun→6
  const s = new Date(d);
  s.setDate(s.getDate() - daysBack);
  s.setHours(0, 0, 0, 0);
  return s;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const showLanguage = useShowLanguage();
  // todayStr is the canonical "today" — the current date in the org timezone as
  // "YYYY-MM-DD". All isToday checks compare cell dates in the same org timezone
  // so the highlighted day always matches what formatInTz displays, regardless of
  // the browser's local timezone.
  const todayStr = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: tz }),
    [tz],
  );
  // Convenience Date for places that need a Date object (kept for startOfWeek etc.)
  const today = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [todayStr]);
  const [view, setView] = useState<View>(() => {
    const stored = localStorage.getItem("dorada_calendar_view");
    return (stored === "month" || stored === "week" || stored === "day") ? stored : "week";
  });
  function changeView(v: View) { localStorage.setItem("dorada_calendar_view", v); setView(v); }
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const stored = localStorage.getItem("dorada_calendar_date");
    if (stored) { const d = new Date(stored); if (!isNaN(d.getTime())) return d; }
    return new Date();
  });
  function changeDate(d: Date) { localStorage.setItem("dorada_calendar_date", d.toISOString()); setCurrentDate(d); }
  const [interpreterFilter, setInterpreterFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showBlocks, setShowBlocks] = useState(false);
  const [tooltip, setTooltip] = useState<{ appt: Record<string, unknown>; x: number; y: number } | null>(null);

  // Date picker popover
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());
  const [pickerLevel, setPickerLevel] = useState<"month" | "day">("month");
  const [pickerDrillMonth, setPickerDrillMonth] = useState(currentDate.getMonth());
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const startTooltip = useCallback((a: Record<string, unknown>) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ appt: a, x: mousePos.current.x, y: mousePos.current.y });
    }, 750);
  }, []);

  const clearTooltip = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }, []);

  const trackMouse = useCallback((e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // ── Date ranges ────────────────────────────────────────────────────────────

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const monthStart = `${year}-${pad(month + 1)}-01`;
  const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`;

  const weekStart = startOfWeek(currentDate, tz);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Day-view date string must use org timezone, not browser-local. The browser
  // (CDT, UTC-6) and the org (PDT, UTC-7) differ by 1 hour, so browser midnight
  // is the previous evening in org tz. toDateStr() would send the wrong date to
  // the API, fetching zero appointments for the day that the header actually shows.
  const dayStr = currentDate.toLocaleDateString("en-CA", { timeZone: tz });

  const dateFrom = view === "month" ? monthStart : view === "week" ? weekStart.toLocaleDateString("en-CA", { timeZone: tz }) : dayStr;
  const dateTo   = view === "month" ? monthEnd   : view === "week" ? weekEnd.toLocaleDateString("en-CA", { timeZone: tz })   : dayStr;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const apptParams: Record<string, string> = { date_from: dateFrom, date_to: dateTo, limit: "500" };
  if (interpreterFilter) apptParams.interpreter_id = interpreterFilter;
  if (clinicFilter !== "all") apptParams.clinic_id = clinicFilter;
  if (statusFilter !== "all") apptParams.status = statusFilter;

  const { data } = useAppointments(apptParams);
  const { data: interpretersData } = useInterpreters({ limit: "100" });
  const { data: clinicsData } = useClinics({ limit: "100" });

  const blockParams = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  if (interpreterFilter) blockParams.set("interpreter_id", interpreterFilter);
  const { data: blocksData } = useQuery({
    queryKey: ["availability-blocks-admin", dateFrom, dateTo, interpreterFilter],
    queryFn: () => api.get<{ data: Array<Record<string, unknown>> }>(`/interpreters/availability-blocks?${blockParams}`),
    enabled: showBlocks,
  });

  const appointments = (data?.data ?? []) as Array<Record<string, unknown>>;
  const availabilityBlocks = (blocksData?.data ?? []) as Array<Record<string, unknown>>;

  const interpreterOptions = ((interpretersData?.data ?? []) as Array<{ id: string; name: string }>).map((i) => ({
    value: i.id,
    label: i.name,
  }));

  const interpreterColorMap = new Map<string, string>();
  availabilityBlocks.forEach((b) => {
    const iid = b.interpreter_id as string;
    if (!interpreterColorMap.has(iid)) {
      interpreterColorMap.set(iid, BLOCK_COLORS[interpreterColorMap.size % BLOCK_COLORS.length]);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function appointmentsForDate(date: Date) {
    // Both sides must use the org timezone. Cell headers are rendered via formatInTz
    // (org tz), so the "target" date for a cell must also be derived in org tz.
    // Using browser-local Date methods (getDate, getMonth, etc.) breaks whenever the
    // browser timezone differs from the org timezone.
    const target = date.toLocaleDateString("en-CA", { timeZone: tz });
    return appointments
      .filter((a) => {
        const apptDateInOrgTz = new Date(a.date_time as string)
          .toLocaleDateString("en-CA", { timeZone: tz });
        return apptDateInOrgTz === target;
      })
      .sort((a, b) => new Date(a.date_time as string).getTime() - new Date(b.date_time as string).getTime());
  }


  function blocksForDate(date: Date) {
    if (!showBlocks) return [];
    // Use org timezone for the cell date, same as appointmentsForDate, so blocks
    // are shown on the correct day regardless of the browser's local timezone.
    const target = date.toLocaleDateString("en-CA", { timeZone: tz });
    return availabilityBlocks.filter((b) => {
      const fromDate = new Date(b.from as string).toLocaleDateString("en-CA", { timeZone: tz });
      const toDate   = new Date(b.to   as string).toLocaleDateString("en-CA", { timeZone: tz });
      return fromDate <= target && toDate >= target;
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function prev() {
    if (view === "month") changeDate(new Date(year, month - 1, 1));
    else if (view === "week") { const d = new Date(currentDate); d.setDate(d.getDate() - 7); changeDate(d); }
    else { const d = new Date(currentDate); d.setDate(d.getDate() - 1); changeDate(d); }
  }
  function next() {
    if (view === "month") changeDate(new Date(year, month + 1, 1));
    else if (view === "week") { const d = new Date(currentDate); d.setDate(d.getDate() + 7); changeDate(d); }
    else { const d = new Date(currentDate); d.setDate(d.getDate() + 1); changeDate(d); }
  }

  const rangeLabel = view === "month"
    ? formatInTz(currentDate, { month: "long", year: "numeric" }, tz)
    : view === "week"
    ? formatInTz(weekStart, { month: "short", day: "numeric" }, tz) +
      " – " +
      formatInTz(weekEnd, { month: "short", day: "numeric", year: "numeric" }, tz)
    : formatInTz(currentDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, tz);

  // ── Month grid ─────────────────────────────────────────────────────────────

  const firstDay = new Date(year, month, 1);
  const cells: Array<Date | null> = [
    // Monday-first: Mon→0 offset, Tue→1, …, Sun→6  ((getDay()+6)%7 maps Sun(0)→6, Mon(1)→0, …, Sat(6)→5)
    ...Array((firstDay.getDay() + 6) % 7).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // ── Shared appointment pill ────────────────────────────────────────────────

  function apptColorClass(a: Record<string, unknown>) {
    const status = a.status as string;
    // Certain terminal/non-active statuses always use their status colour regardless of interpreter
    if (status === "cancelled" || status === "completed" || status === "declined" || status === "unassigned") {
      return STATUS_COLORS[status] ?? "bg-muted border-gray-300";
    }
    const hasInterpreter = !!(a.interpreter as Record<string, unknown> | null)?.id;
    if (!hasInterpreter) {
      const hasPendingOffer = ((a.offers as Array<unknown>) ?? []).length > 0;
      if (hasPendingOffer) return "bg-orange-100 border-orange-300 text-orange-900";
      return "bg-gray-100 border-gray-300 text-gray-500";
    }
    // Confirmed + billing pending approval → blue
    if (status === "confirmed" && (a.billing_approval_status as string) === "pending_approval") {
      return "bg-blue-100 border-blue-400 text-blue-900";
    }
    return STATUS_COLORS[status] ?? "bg-muted border-gray-300";
  }

  function ApptPill({ a }: { a: Record<string, unknown> }) {
    return (
      <button
        onClick={() => navigate(`/appointments/${a.id}`)}
        onMouseEnter={() => startTooltip(a)}
        onMouseLeave={clearTooltip}
        onMouseMove={trackMouse}
        className={`w-full truncate rounded border px-1 py-0.5 text-left text-xs ${apptColorClass(a)}`}
      >
        {formatInTz(a.date_time as string, { hour: "2-digit", minute: "2-digit" }, tz)}{" "}
        {(a.patient as Record<string, unknown>)?.name as string ?? "—"}
      </button>
    );
  }

  function WeekApptCard({ a }: { a: Record<string, unknown> }) {
    const dt = new Date(a.date_time as string);
    const endDt = new Date(dt.getTime() + (a.duration_minutes as number) * 60000);
    const timeStr =
      formatInTz(dt, { hour: "2-digit", minute: "2-digit" }, tz) +
      " – " +
      formatInTz(endDt, { hour: "2-digit", minute: "2-digit" }, tz);
    const patientName = (a.patient as Record<string, unknown>)?.name as string ?? "—";
    const clinicName = (a.clinic as Record<string, unknown>)?.name as string;
    const agencyName = (a.agency as Record<string, unknown>)?.name as string;
    const interpreterName = (a.interpreter as Record<string, unknown>)?.name as string | null ?? null;
    const physician = a.referring_physician as string | null;
    const colorClass = apptColorClass(a);
    return (
      <button
        onClick={() => navigate(`/appointments/${a.id}`)}
        onMouseEnter={() => startTooltip(a)}
        onMouseLeave={clearTooltip}
        onMouseMove={trackMouse}
        className={`w-full rounded border px-1.5 py-1 text-left space-y-0.5 ${colorClass}`}
      >
        <p className="text-xs font-bold leading-tight truncate">{patientName}</p>
        <p className="text-xs leading-tight text-current/80">{timeStr}</p>
        {clinicName && <p className="text-xs leading-tight truncate opacity-75">{clinicName}</p>}
        {agencyName && <p className="text-xs leading-tight truncate opacity-75">{agencyName}</p>}
        {physician && <p className="text-xs leading-tight truncate opacity-75">{physician}</p>}
        <p className="text-xs leading-tight truncate opacity-75 italic">
          {interpreterName ?? t("appointments.unassigned")}
        </p>
      </button>
    );
  }

  function DayApptCard({ a }: { a: Record<string, unknown> }) {
    const dt = new Date(a.date_time as string);
    const endDt = new Date(dt.getTime() + (a.duration_minutes as number) * 60000);
    const timeStr =
      formatInTz(dt, { hour: "2-digit", minute: "2-digit" }, tz) +
      " – " +
      formatInTz(endDt, { hour: "2-digit", minute: "2-digit" }, tz);
    const patientName = (a.patient as Record<string, unknown>)?.name as string ?? "—";
    const clinicName = (a.clinic as Record<string, unknown>)?.name as string | null ?? null;
    const agencyName = (a.agency as Record<string, unknown>)?.name as string | null ?? null;
    const interpreterName = (a.interpreter as Record<string, unknown>)?.name as string | null ?? null;
    const physician = a.referring_physician as string | null;
    const poNumber = a.po_number as string | null;
    const status = String(a.status).replace(/_/g, " ");
    const language = a.language as string | null;
    const interpType = a.interpreter_type_required as string | null;
    const colorClass = apptColorClass(a);
    return (
      <button
        onClick={() => navigate(`/appointments/${a.id}`)}
        className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-opacity hover:opacity-90 ${colorClass}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-base leading-tight truncate">
              <span className="font-bold">{patientName}</span>
              {poNumber && <span className="font-normal text-sm ml-2 opacity-75">{poNumber}</span>}
            </p>
            <p className="text-sm font-medium mt-0.5">{timeStr} · {a.duration_minutes as number} min</p>
          </div>
          <span className="shrink-0 text-xs font-semibold capitalize px-2 py-0.5 rounded-full border border-current/30 bg-white/40">
            {status}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
          {showLanguage && language && <DayRow label={t("appointments.language")} value={language} />}
          {interpType && <DayRow label={t("appointments.interpreter_type")} value={interpType} />}
          <DayRow label={t("appointments.interpreter")} value={interpreterName ?? t("appointments.unassigned")} italic={!interpreterName} bold />
          {clinicName && <DayRow label={t("appointments.clinic")} value={clinicName} />}
          {agencyName && <DayRow label={t("appointments.agency")} value={agencyName} bold />}
          {physician && <DayRow label={t("appointments.provider")} value={physician} />}
        </div>
      </button>
    );
  }

  function BlockPill({ b }: { b: Record<string, unknown> }) {
    return (
      <div
        className={`truncate rounded border px-1 py-0.5 text-xs ${interpreterColorMap.get(b.interpreter_id as string) ?? "bg-gray-100"}`}
        title={`${(b.interpreter as Record<string, unknown>)?.name as string}${b.reason ? ` — ${b.reason}` : ""}`}
      >
        🚫 {(b.interpreter as Record<string, unknown>)?.name as string}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title={t("nav.calendar")}
        actions={
          <Button onClick={() => navigate("/appointments/new")}>
            <Plus className="mr-2 h-4 w-4" /> {t("appointments.new")}
          </Button>
        }
      />

      <div className="sticky top-0 z-20 -mx-6 px-6 bg-background">
        {/* ── Filter controls row ── */}
        <div className="flex flex-wrap items-center gap-3 py-3 border-b">
          {/* View toggle */}
          <div className="flex rounded-md border">
            {(["month", "week", "day"] as View[]).map((v, i, arr) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={[
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  i === 0 ? "rounded-l-md" : i === arr.length - 1 ? "rounded-r-md" : "",
                  i > 0 ? "border-l" : "",
                  view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                ].join(" ")}
              >
                {t(`calendar.${v}`)}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="relative">
              <button
                onClick={() => {
                  setPickerYear(currentDate.getFullYear());
                  setPickerLevel("month");
                  setPickerDrillMonth(currentDate.getMonth());
                  setDatePickerOpen((v) => !v);
                }}
                className="min-w-44 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-semibold hover:bg-muted transition-colors"
                title="Jump to date"
              >
                {rangeLabel}
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
              {datePickerOpen && (
                <JumpToDatePicker
                  pickerYear={pickerYear}
                  selectedYear={currentDate.getFullYear()}
                  selectedMonth={currentDate.getMonth()}
                  selectedDay={currentDate.getDate()}
                  level={pickerLevel}
                  drillMonth={pickerDrillMonth}
                  onLevelChange={setPickerLevel}
                  onDrillMonthChange={setPickerDrillMonth}
                  onYearChange={setPickerYear}
                  onSelect={(y, m, d) => {
                    changeDate(new Date(y, m, d));
                    setDatePickerOpen(false);
                  }}
                  onClose={() => setDatePickerOpen(false)}
                />
              )}
            </div>
            <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          {/* Interpreter autocomplete */}
          <div className="w-52">
            <AutocompleteInput
              options={interpreterOptions}
              value={interpreterFilter}
              onChange={setInterpreterFilter}
              placeholder={t("appointments.filter_interpreter")}
            />
          </div>

          {/* Clinic autocomplete */}
          <div className="w-52">
            <AutocompleteInput
              options={((clinicsData?.data ?? []) as Array<{ id: string; name: string }>).map((c) => ({ value: c.id, label: c.name }))}
              value={clinicFilter === "all" ? "" : clinicFilter}
              onChange={(v) => setClinicFilter(v || "all")}
              placeholder={t("appointments.clinic")}
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("common.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="unassigned">{t("calendar.status_unassigned")}</SelectItem>
              <SelectItem value="pending_offer">{t("calendar.status_pending_offer")}</SelectItem>
              <SelectItem value="confirmed">{t("calendar.status_confirmed")}</SelectItem>
              <SelectItem value="in_progress">{t("calendar.status_in_progress")}</SelectItem>
              <SelectItem value="completed">{t("calendar.status_completed")}</SelectItem>
              <SelectItem value="cancelled">{t("calendar.status_cancelled")}</SelectItem>
              <SelectItem value="declined">{t("calendar.status_declined")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Schedule blocks toggle */}
          <Button variant={showBlocks ? "default" : "outline"} onClick={() => setShowBlocks((v) => !v)} className="gap-2">
            <CalendarOff className="h-4 w-4" />
            {showBlocks ? t("calendar.hide_blocks") : t("calendar.show_blocks")}
          </Button>

          {(interpreterFilter || clinicFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={() => { setInterpreterFilter(""); setClinicFilter("all"); }}>{t("common.clear")}</Button>
          )}
        </div>

        {/* ── Sticky column headers (view-specific) ── */}
        {view === "month" && (
          <div className="-mx-6 grid grid-cols-7 bg-muted/50 border-b">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
        )}
        {view === "week" && (
          <div className="-mx-6 grid grid-cols-7 bg-muted/50 border-b">
            {weekDays.map((date) => {
              const isToday = date.toLocaleDateString("en-CA", { timeZone: tz }) === todayStr;
              const dayTotal = appointmentsForDate(date).length;
              return (
                <div key={date.toISOString()} className="p-2 text-center border-r last:border-r-0">
                  <p className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-muted-foreground"}`}>
                    {formatInTz(date, { weekday: "short" }, tz).toUpperCase()}{" "}
                    {formatInTz(date, { month: "short" }, tz)}{" "}
                    <span className="font-bold">{formatInTz(date, { day: "numeric" }, tz)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total: {dayTotal}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {view === "day" && (
          <div className={`py-3 border-b ${currentDate.toLocaleDateString("en-CA", { timeZone: tz }) === todayStr ? "bg-blue-50" : "bg-muted/50"}`}>
            <p className={`text-sm font-semibold ${currentDate.toLocaleDateString("en-CA", { timeZone: tz }) === todayStr ? "text-blue-700" : "text-muted-foreground"}`}>
              {formatInTz(currentDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, tz)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {appointmentsForDate(currentDate).length} appointment{appointmentsForDate(currentDate).length !== 1 ? "s" : ""}
              {blocksForDate(currentDate).length > 0 && ` · ${blocksForDate(currentDate).length} block${blocksForDate(currentDate).length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}
      </div>

      {/* ── Month view ── */}
      {view === "month" && (
        <div className="-mx-6 border-x border-b">
          <div className="grid grid-cols-7">
            {cells.map((date, idx) => {
              const dayAppts = date ? appointmentsForDate(date) : [];
              const dayBlocks = date ? blocksForDate(date) : [];
              const isToday = date ? date.toLocaleDateString("en-CA", { timeZone: tz }) === todayStr : false;
              return (
                <div key={idx} className="min-h-24 border-b border-r p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0">
                  {date && (
                    <>
                      <p className={`mb-1 text-xs font-medium ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white" : "text-muted-foreground"}`}>
                        {date.getDate()}
                      </p>
                      <div className="space-y-0.5">
                        {dayAppts.slice(0, 3).map((a) => <ApptPill key={a.id as string} a={a} />)}
                        {dayAppts.length > 3 && (
                          <p className="px-1 text-xs text-muted-foreground">+{dayAppts.length - 3} more</p>
                        )}
                        {dayBlocks.map((b) => <BlockPill key={b.id as string} b={b} />)}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week view ── */}
      {view === "week" && (
        <div className="-mx-6 border-x border-b overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[700px]">
            {weekDays.map((date) => {
              const dayAppts = appointmentsForDate(date);
              const dayBlocks = blocksForDate(date);
              const isToday = date.toLocaleDateString("en-CA", { timeZone: tz }) === todayStr;
              return (
                <div key={date.toISOString()} className={`border-r last:border-r-0 p-1.5 min-h-32 space-y-1 ${isToday ? "bg-blue-50/50" : ""}`}>
                  {dayAppts.map((a) => <WeekApptCard key={a.id as string} a={a} />)}
                  {dayBlocks.map((b) => <BlockPill key={b.id as string} b={b} />)}
                  {dayAppts.length === 0 && dayBlocks.length === 0 && (
                    <p className="text-xs text-muted-foreground/40 text-center pt-4">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day view ── */}
      {view === "day" && (
        <div className="-mx-6 border-x border-b">
          <div className="p-4 space-y-3">
            {blocksForDate(currentDate).map((b) => (
              <div
                key={b.id as string}
                className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${interpreterColorMap.get(b.interpreter_id as string) ?? "bg-gray-100"}`}
              >
                <span className="text-lg">🚫</span>
                <div>
                  <p className="text-sm font-semibold">{(b.interpreter as Record<string, unknown>)?.name as string}</p>
                  {b.reason && <p className="text-xs opacity-75">{b.reason as string}</p>}
                </div>
              </div>
            ))}
            {appointmentsForDate(currentDate).map((a) => (
              <DayApptCard key={a.id as string} a={a} />
            ))}
            {appointmentsForDate(currentDate).length === 0 && blocksForDate(currentDate).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("calendar.no_appointments")}</p>
            )}
          </div>
        </div>
      )}

      {tooltip && <ApptTooltip appt={tooltip.appt} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}

// ─── Jump-to-date picker popover ──────────────────────────────────────────────

const MONTH_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function JumpToDatePicker({
  pickerYear,
  selectedYear,
  selectedMonth,
  selectedDay,
  level,
  drillMonth,
  onLevelChange,
  onDrillMonthChange,
  onYearChange,
  onSelect,
  onClose,
}: {
  pickerYear: number;
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  level: "month" | "day";
  drillMonth: number;
  onLevelChange: (l: "month" | "day") => void;
  onDrillMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
  onSelect: (year: number, month: number, day: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose]);

  const todayYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth();
  const todayDay = new Date().getDate();

  // Build day grid cells for the drill-down month
  function buildDayCells(year: number, month: number): Array<number | null> {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [...Array(firstDow).fill(null)];
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  const dayCells = level === "day" ? buildDayCells(pickerYear, drillMonth) : [];

  return (
    <div
      ref={ref}
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 rounded-lg border bg-popover shadow-xl"
      style={{ width: "224px" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {level === "month" ? (
        <>
          {/* Year navigation */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <button onClick={() => onYearChange(pickerYear - 1)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold">{pickerYear}</span>
            <button onClick={() => onYearChange(pickerYear + 1)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1 p-2">
            {MONTH_ABBRS.map((abbr, idx) => {
              const isSelected = idx === selectedMonth && pickerYear === selectedYear;
              const isToday = idx === todayMonth && pickerYear === todayYear;
              return (
                <button
                  key={abbr}
                  onClick={() => { onDrillMonthChange(idx); onLevelChange("day"); }}
                  className={[
                    "rounded-md py-1.5 text-xs font-medium transition-colors",
                    isSelected ? "bg-primary text-primary-foreground"
                      : isToday ? "ring-1 ring-primary text-primary hover:bg-muted"
                      : "hover:bg-muted text-foreground",
                  ].join(" ")}
                >
                  {abbr}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Day-level header: back + prev/next month */}
          <div className="flex items-center justify-between px-2 py-2 border-b">
            <button onClick={() => onLevelChange("month")} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors" title="Back to months">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onLevelChange("month")}
              className="text-xs font-bold hover:underline"
            >
              {MONTH_NAMES[drillMonth]} {pickerYear}
            </button>
            <button
              onClick={() => {
                if (drillMonth === 11) { onYearChange(pickerYear + 1); onDrillMonthChange(0); }
                else onDrillMonthChange(drillMonth + 1);
              }}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-1 pt-1">
            {DAY_HEADERS.map((h) => (
              <div key={h} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{h}</div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7 px-1 pb-2 gap-y-0.5">
            {dayCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const isSelected = day === selectedDay && drillMonth === selectedMonth && pickerYear === selectedYear;
              const isToday = day === todayDay && drillMonth === todayMonth && pickerYear === todayYear;
              return (
                <button
                  key={day}
                  onClick={() => onSelect(pickerYear, drillMonth, day)}
                  className={[
                    "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isSelected ? "bg-primary text-primary-foreground"
                      : isToday ? "ring-1 ring-primary text-primary hover:bg-muted"
                      : "hover:bg-muted text-foreground",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ApptTooltip({ appt: a, x, y }: { appt: Record<string, unknown>; x: number; y: number }) {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const showLanguage = useShowLanguage();

  const dt = new Date(a.date_time as string);
  const endDt = new Date(dt.getTime() + (a.duration_minutes as number) * 60000);
  const timeStr = formatInTz(dt, { dateStyle: "medium", timeStyle: "short" }, tz);
  const durationStr = `${a.duration_minutes} min`;
  const patientName = (a.patient as Record<string, unknown>)?.name as string ?? "—";
  const poNumber = a.po_number as string | null;
  const status = String(a.status).replace(/_/g, " ");
  const language = a.language as string;
  const interpType = a.interpreter_type_required as string;
  const clinicName = (a.clinic as Record<string, unknown>)?.name as string ?? "—";
  const agencyName = (a.agency as Record<string, unknown>)?.name as string ?? "—";
  const interpreterName = (a.interpreter as Record<string, unknown>)?.name as string ?? t("appointments.unassigned");
  const physician = a.referring_physician as string | null;

  const flipLeft = x + 280 > window.innerWidth;
  const flipUp = y + 320 > window.innerHeight;

  return (
    <div
      className="fixed z-50 w-64 rounded-lg border bg-popover shadow-lg text-sm"
      style={{
        left: flipLeft ? x - 272 : x + 12,
        top: flipUp ? y - 8 : y + 12,
        pointerEvents: "none",
      }}
    >
      <div className="border-b px-3 py-2 font-semibold">{patientName}</div>
      <div className="px-3 py-2 space-y-1.5">
        <Row label={t("appointments.po_number")} value={poNumber ?? "—"} />
        <Row label={t("common.status")} value={<span className="capitalize">{status}</span>} />
        <Row label={t("appointments.date_time")} value={timeStr} />
        <Row label={t("appointments.duration")} value={durationStr} />
        {showLanguage && <Row label={t("appointments.language")} value={language} />}
        <Row label={t("appointments.interpreter_type")} value={interpType} />
        <Row label={t("appointments.clinic")} value={clinicName} />
        <Row label={t("appointments.agency")} value={agencyName} />
        <Row label={t("appointments.interpreter")} value={interpreterName} />
        {physician && <Row label={t("appointments.provider")} value={physician} />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function DayRow({ label, value, italic, bold }: { label: string; value: string; italic?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-current/60 font-normal shrink-0">{label}:</span>
      <span className={`truncate ${bold ? "font-bold" : "font-medium"} ${italic ? "italic opacity-70" : ""}`}>{value}</span>
    </div>
  );
}
