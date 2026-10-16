import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DollarSign, FileCheck, Clock } from "lucide-react";
import { api } from "../lib/api";

type Period = "month" | "ytd" | "all" | "custom";

function getDateRange(period: Period): { date_from?: string; date_to?: string } {
  const now = new Date();
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_from: from.toISOString().slice(0, 10) };
  }
  if (period === "ytd") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { date_from: from.toISOString().slice(0, 10) };
  }
  return {};
}

export default function EarningsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = period === "custom"
    ? { ...(customFrom ? { date_from: customFrom } : {}), ...(customTo ? { date_to: customTo } : {}) }
    : getDateRange(period);

  const params = new URLSearchParams(range as Record<string, string>).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["earnings", range],
    queryFn: () => api.get<{ data: unknown[] }>(`/invoices/me${params ? `?${params}` : ""}`),
  });

  const invoices = (data?.data ?? []) as Array<Record<string, unknown>>;
  const total = invoices.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
  const approved = invoices.filter((inv) => inv.status === "approved");
  const submitted = invoices.filter((inv) => inv.status === "submitted");
  const approvedTotal = approved.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);

  const periods: { key: Period; label: string }[] = [
    { key: "month", label: t("earnings.this_month") },
    { key: "ytd", label: t("earnings.year_to_date") },
    { key: "all", label: t("earnings.all_time") },
    { key: "custom", label: t("earnings.custom") },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-bold">{t("nav.earnings")}</h1>

        {/* Period filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {periods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                period === key ? "bg-forest text-white" : "bg-surface border border-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex gap-3">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-forest"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-forest"
            />
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard icon={<DollarSign size={18} />} label={t("earnings.total")} value={`$${total.toFixed(2)}`} color="text-forest" />
          <SummaryCard icon={<FileCheck size={18} />} label={t("earnings.approved")} value={String(approved.length)} color="text-green-600" />
          <SummaryCard icon={<Clock size={18} />} label={t("earnings.submitted")} value={String(submitted.length)} color="text-amber-600" />
        </div>

        {/* Invoice list */}
        {isLoading ? (
          <p className="text-center text-[var(--color-text-subtle)] mt-8">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-center text-[var(--color-text-subtle)] mt-8">{t("earnings.no_invoices")}</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const appt = inv.appointment as Record<string, unknown> | undefined;
              const patient = appt?.patient as Record<string, unknown> | undefined;
              const clinic = appt?.clinic as Record<string, unknown> | undefined;
              const dt = appt?.date_time ? new Date(appt.date_time as string) : null;
              const duration = appt?.duration_minutes as number | undefined;
              return (
                <div key={inv.id as string} className="bg-surface rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{(patient?.name as string) ?? "—"}</p>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      inv.status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>{inv.status as string}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {dt ? dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "—"}
                    {dt ? ` · ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{(clinic?.name as string) ?? ""}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{duration ? `${duration} min` : ""}</span>
                    <span className="font-bold">${Number(inv.amount ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-xl p-3 text-center">
      <div className={`mx-auto mb-1 ${color}`}>{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
    </div>
  );
}
