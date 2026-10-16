import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function DateRangePicker({ start, end, onChange }: {
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
}) {
  const today = new Date();
  const todayStr = fmt(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function prev() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  function handleTap(dateStr: string) {
    if (dateStr < todayStr) return;
    if (!start || (start && end)) {
      onChange(dateStr, "");
    } else if (dateStr < start) {
      onChange(dateStr, "");
    } else {
      onChange(start, dateStr);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prev} className="p-1.5 active:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button type="button" onClick={next} className="p-1.5 active:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {weekdays.map((wd) => (
          <div key={wd} className="text-center text-[10px] font-semibold text-[var(--color-text-muted)] uppercase pb-1.5">{wd}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateStr = fmt(viewYear, viewMonth, day);
          const isPast = dateStr < todayStr;
          const isStart = dateStr === start;
          const isEnd = dateStr === end;
          const inRange = start && end && dateStr > start && dateStr < end;
          const isToday = dateStr === todayStr;

          let bg = "";
          let text = "text-[var(--color-text)]";
          let rounded = "rounded-full";
          if (isStart || isEnd) { bg = "bg-forest"; text = "text-white"; }
          else if (inRange) { bg = "bg-forest/10"; text = "text-forest"; rounded = "rounded-none"; }
          if (isPast) text = "text-[var(--color-text-subtle)] opacity-40";

          if (isStart && end) rounded = "rounded-l-full";
          if (isEnd && start) rounded = "rounded-r-full";
          if (isStart && !end) rounded = "rounded-full";

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => handleTap(dateStr)}
              className={`h-9 flex items-center justify-center text-sm font-medium ${bg} ${text} ${rounded} transition-colors ${!isPast ? "active:opacity-70" : ""}`}
            >
              <span className={isToday && !isStart && !isEnd ? "underline underline-offset-2" : ""}>{day}</span>
            </button>
          );
        })}
      </div>
      {start && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2 text-center">
          {end
            ? `${new Date(start + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" })} – ${new Date(end + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}`
            : `${new Date(start + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" })} – select end date`}
        </p>
      )}
    </div>
  );
}

export default function AvailabilityPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["availability"],
    queryFn: () => api.get<{ data: unknown[] }>("/interpreters/me/availability"),
  });

  const addBlock = useMutation({
    mutationFn: (body: unknown) => api.post("/interpreters/me/availability", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    },
  });

  const deleteBlock = useMutation({
    mutationFn: (blockId: string) => api.delete(`/interpreters/me/availability/${blockId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
  });

  const blocks = (data?.data ?? []) as Array<Record<string, unknown>>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    addBlock.mutate({ from: new Date(startDate).toISOString(), to: new Date(endDate + "T23:59:59").toISOString(), reason: reason || undefined });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{t("nav.availability")}</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-forest text-white px-4 py-2 rounded-lg text-sm font-semibold active:opacity-80"
          >
            <Plus size={16} />
            {t("common.add")}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-surface rounded-xl p-4 space-y-3 border border-[var(--color-border)]">
            <DateRangePicker
              start={startDate}
              end={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            />
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("availability.reason")}</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("availability.reason_placeholder")}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-forest"
              />
            </div>
            <button
              type="submit"
              disabled={addBlock.isPending || !startDate || !endDate}
              className="w-full bg-forest text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-60 active:opacity-80"
            >
              {addBlock.isPending ? t("common.loading") : t("common.save")}
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-center text-[var(--color-text-subtle)] mt-12">Loading…</p>
        ) : blocks.length === 0 ? (
          <div className="text-center mt-12">
            <Calendar size={40} className="mx-auto text-[var(--color-text-subtle)] mb-3" />
            <p className="text-[var(--color-text-subtle)]">{t("availability.no_blocks")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div key={block.id as string} className="bg-surface rounded-xl p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {new Date(block.from as string).toLocaleDateString()} – {new Date(block.to as string).toLocaleDateString()}
                  </p>
                  {block.reason && <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{block.reason as string}</p>}
                </div>
                <button
                  onClick={() => deleteBlock.mutate(block.id as string)}
                  disabled={deleteBlock.isPending}
                  className="p-2 text-red-500 active:bg-red-50 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
