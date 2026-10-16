import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Check, X, AlertCircle, AlertTriangle, Info, Bell } from "lucide-react";
import { useMyAppointments, useAppointmentOffers, useConfirmOffer, useDeclineOffer } from "../hooks/useAppointments";
import { usePushNotifications } from "../hooks/usePushNotifications";

const STATUS_COLORS: Record<string, string> = {
  accepted: "bg-green-500",
  pending_offer: "bg-amber-500",
  in_progress: "bg-blue-500",
  completed: "bg-slate-400",
  cancelled: "bg-red-500",
};

type Tab = "upcoming" | "offers" | "history";

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("upcoming");

  const { data: appts, isLoading: apptLoading, refetch: refetchAppts } = useMyAppointments({ status: "accepted,in_progress", limit: "30" });
  const { data: offers, isLoading: offersLoading, refetch: refetchOffers } = useAppointmentOffers();
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useMyAppointments({ status: "completed,cancelled", limit: "50", sort: "desc" });

  const upcoming = (appts?.data ?? []) as Array<Record<string, unknown>>;
  const pendingOffers = (offers?.data ?? []) as Array<Record<string, unknown>>;
  const history = (historyData?.data ?? []) as Array<Record<string, unknown>>;

  const { supported, subscribed, permission, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("dorada-push-dismissed") === "1");
  const showBanner = supported && !subscribed && permission !== "denied" && !dismissed;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "upcoming", label: t("appointments.upcoming") },
    { key: "offers", label: t("appointments.offers"), badge: pendingOffers.length || undefined },
    { key: "history", label: t("appointments.history") },
  ];

  return (
    <div className="flex flex-col h-full">
      {showBanner && (
        <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-3">
          <Bell size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">Enable notifications to get alerts for new offers.</p>
          <button
            onClick={() => subscribe()}
            className="text-sm font-semibold text-forest whitespace-nowrap"
          >
            Enable
          </button>
          <button
            onClick={() => { setDismissed(true); localStorage.setItem("dorada-push-dismissed", "1"); }}
            className="text-sm text-[var(--color-text-muted)]"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex bg-surface border-b border-[var(--color-border)]">
        {tabs.map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3.5 text-base font-medium text-center relative transition-colors ${
              tab === key ? "text-forest" : "text-[var(--color-text)]"
            }`}
          >
            {label}
            {badge ? <span className="ml-1 text-red-500 font-bold">{badge}</span> : null}
            {tab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === "upcoming" && (
          apptLoading ? <Loading /> :
          upcoming.length === 0 ? <Empty text={t("appointments.no_upcoming")} /> :
          upcoming.map((item) => <AppointmentCard key={item.id as string} item={item} />)
        )}
        {tab === "offers" && (
          offersLoading ? <Loading /> :
          pendingOffers.length === 0 ? <Empty text={t("appointments.no_offers")} /> :
          pendingOffers.map((item) => <OfferCard key={(item.offer_id as string) ?? (item.id as string)} offer={item} />)
        )}
        {tab === "history" && (
          historyLoading ? <Loading /> :
          history.length === 0 ? <Empty text={t("appointments.no_history")} /> :
          history.map((item) => <AppointmentCard key={item.id as string} item={item} />)
        )}
      </div>
    </div>
  );
}

function AppointmentCard({ item }: { item: Record<string, unknown> }) {
  const navigate = useNavigate();
  const clinic = item.clinic as Record<string, unknown> | null;
  const patient = item.patient as Record<string, unknown> | null;
  const dt = new Date(item.date_time as string);
  const notes = (clinic?.interpreter_notes as Array<{ id: string; type: string }>) ?? [];
  const noteTypes = [...new Set(notes.map((n) => n.type))];
  const isInProgress = item.status === "in_progress";

  return (
    <button
      onClick={() => navigate(`/appointments/${item.id}`)}
      className={`w-full rounded-xl p-4 shadow-sm text-left relative transition-colors ${
        isInProgress ? "bg-amber-50 border border-amber-300 active:bg-amber-100" : "bg-surface active:bg-gray-50"
      }`}
    >
      {isInProgress && (
        <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-amber-700 bg-amber-200 rounded px-1.5 py-0.5 mb-2">In Progress</span>
      )}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status as string] ?? "bg-slate-400"}`} />
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {noteTypes.length > 0 && (
          <div className="ml-auto mr-6 flex gap-1">
            {noteTypes.map((type) =>
              type === "important" ? <AlertCircle key={type} size={18} className="text-red-600" /> :
              type === "notice" ? <AlertTriangle key={type} size={18} className="text-amber-600" /> :
              <Info key={type} size={18} className="text-blue-600" />
            )}
          </div>
        )}
      </div>
      <p className="font-bold text-[var(--color-text)]">{(patient?.name as string) ?? "—"}</p>
      <p className="text-sm text-[var(--color-text-muted)]">{(clinic?.name as string) ?? "—"}</p>
      <p className="text-xs text-[var(--color-text-subtle)]">{item.language as string}</p>
      <ChevronRight size={16} className="absolute right-4 bottom-4 text-[var(--color-text-muted)]" />
    </button>
  );
}

function OfferCard({ offer }: { offer: Record<string, unknown> }) {
  const { t } = useTranslation();
  const confirm = useConfirmOffer(offer.id as string, offer.offer_id as string);
  const decline = useDeclineOffer(offer.id as string, offer.offer_id as string);

  return (
    <div className="bg-surface rounded-xl p-4 border border-amber-300">
      <p className="text-sm font-semibold">{new Date(offer.date_time as string).toLocaleString()}</p>
      <p className="font-bold mt-1">{offer.clinic_name as string}</p>
      <p className="text-sm text-[var(--color-text-muted)]">
        {offer.language as string} · {offer.interpreter_type_required as string}
      </p>
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-semibold disabled:opacity-60 active:opacity-80"
        >
          <Check size={18} />
          {t("appointments.confirm")}
        </button>
        <button
          onClick={() => decline.mutate()}
          disabled={decline.isPending}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg font-semibold disabled:opacity-60 active:opacity-80"
        >
          <X size={18} />
          {t("appointments.decline")}
        </button>
      </div>
    </div>
  );
}

function Loading() {
  return <p className="text-center text-[var(--color-text-subtle)] mt-12">Loading…</p>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-[var(--color-text-subtle)] mt-12">{text}</p>;
}
