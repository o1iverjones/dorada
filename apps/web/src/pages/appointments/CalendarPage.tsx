import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAppointments } from "../../hooks/useAppointments.js";
import { useInterpreters } from "../../hooks/useInterpreters.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Button } from "../../components/ui/button.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.js";
import { StatusBadge } from "../../components/shared/StatusBadge.js";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-100 border-green-300 text-green-800",
  pending_offer: "bg-yellow-100 border-yellow-300 text-yellow-800",
  in_progress: "bg-blue-100 border-blue-300 text-blue-800",
  completed: "bg-gray-100 border-gray-300 text-gray-600",
  cancelled: "bg-red-100 border-red-300 text-red-800",
};

export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [interpreterFilter, setInterpreterFilter] = useState("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const params: Record<string, string> = {
    date_from: firstDay.toISOString().slice(0, 10),
    date_to: lastDay.toISOString().slice(0, 10),
    limit: "200",
  };
  if (interpreterFilter !== "all") params.interpreter_id = interpreterFilter;

  const { data } = useAppointments(params);
  const { data: interpreters } = useInterpreters({ limit: "100" });

  const appointments = (data?.data ?? []) as Array<Record<string, unknown>>;

  // Build calendar grid (Sun–Sat)
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells: Array<number | null> = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function appointmentsForDay(day: number) {
    return appointments.filter((a) => {
      const d = new Date(a.date_time as string);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const monthLabel = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("nav.calendar")}
        actions={
          <Button onClick={() => navigate("/appointments/new")}>
            <Plus className="mr-2 h-4 w-4" /> {t("appointments.new")}
          </Button>
        }
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-40 text-center font-semibold">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Select value={interpreterFilter} onValueChange={setInterpreterFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("appointments.filter_interpreter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {((interpreters?.data ?? []) as Array<{ id: string; name: string }>).map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const dayAppts = day ? appointmentsForDay(day) : [];
            return (
              <div
                key={idx}
                className="min-h-24 border-b border-r p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0"
              >
                {day && (
                  <>
                    <p className="mb-1 text-xs text-muted-foreground">{day}</p>
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 3).map((a) => (
                        <button
                          key={a.id as string}
                          onClick={() => navigate(`/appointments/${a.id}`)}
                          className={`w-full truncate rounded border px-1 py-0.5 text-left text-xs ${STATUS_COLORS[a.status as string] ?? "bg-muted"}`}
                        >
                          {new Date(a.date_time as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {a.patient_name as string}
                        </button>
                      ))}
                      {dayAppts.length > 3 && (
                        <p className="px-1 text-xs text-muted-foreground">+{dayAppts.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
