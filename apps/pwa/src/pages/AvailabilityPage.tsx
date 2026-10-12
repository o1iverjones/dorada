import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Calendar } from "lucide-react";
import { api } from "../lib/api";

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
    addBlock.mutate({ start_date: startDate, end_date: endDate, reason: reason || undefined });
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
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("availability.start_date")}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-forest"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t("availability.end_date")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().slice(0, 10)}
                required
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-forest"
              />
            </div>
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
              disabled={addBlock.isPending}
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
                    {new Date(block.start_date as string).toLocaleDateString()} – {new Date(block.end_date as string).toLocaleDateString()}
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
