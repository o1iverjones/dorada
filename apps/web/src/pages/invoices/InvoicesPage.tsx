import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { useInvoices, useApproveInvoice } from "../../hooks/useInvoices.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Card, CardContent } from "../../components/ui/card.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

const LONG_APPT_MINUTES = 120;

function actualDurationMins(appt: Invoice["appointment"]): number | null {
  if (!appt?.clock_in_time || !appt?.clock_out_time) return null;
  return Math.round((new Date(appt.clock_out_time).getTime() - new Date(appt.clock_in_time).getTime()) / 60000);
}

type Invoice = {
  id: string;
  appointment_id: string;
  status: "submitted" | "approved";
  amount: number;
  billable_minutes: number;
  pay_rate: number;
  submitted_at: string;
  approved_at: string | null;
  notes: string | null;
  appointment?: {
    id: string;
    date_time: string;
    duration_minutes: number;
    po_number: string | null;
    clock_in_time: string | null;
    clock_in_distance_miles: number | null;
    clock_out_time: string | null;
    patient: { id: string; name: string };
    clinic: { id: string; name: string };
  };
  interpreter?: { id: string; name: string };
  approved_by?: { id: string; name: string } | null;
};

type StatusFilter = "all" | "submitted" | "approved";

export function InvoicesPage() {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("submitted");
  const [approving, setApproving] = useState<Invoice | null>(null);

  const params: Record<string, string> = {
    limit: "100",
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data, isLoading } = useInvoices(params);
  const invoices = (data?.data ?? []) as Invoice[];

  const totalSubmitted = invoices.filter((i) => i.status === "submitted").length;
  const totalAmount = invoices.reduce((sum, i) => sum + i.amount, 0);

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "submitted", label: t("invoices.status_submitted") },
    { key: "approved", label: t("invoices.status_approved") },
    { key: "all", label: t("common.all") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.invoices")} />

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label={t("invoices.pending_approval")} value={totalSubmitted} accent="orange" />
        <SummaryCard label={t("invoices.total_amount")} value={`$${totalAmount.toFixed(2)}`} />
        <SummaryCard label={t("invoices.total_invoices")} value={invoices.length} />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`rounded-full border px-4 py-1 text-sm transition-colors ${
              statusFilter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("invoices.empty")}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("invoices.interpreter")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("appointments.patient")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("appointments.po_number")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("appointments.date_time")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("invoices.clock_times")}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("invoices.duration")}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("invoices.amount")}</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("common.status")}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      tz={tz}
                      onApprove={() => setApproving(inv)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {approving && (
        <ApproveDialog
          invoice={approving}
          onClose={() => setApproving(null)}
        />
      )}
    </div>
  );
}

function InvoiceRow({ invoice: inv, tz, onApprove }: { invoice: Invoice; tz: string; onApprove: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dt = inv.appointment?.date_time ? new Date(inv.appointment.date_time) : null;
  const durMins = actualDurationMins(inv.appointment);
  const isLong = durMins != null && durMins > LONG_APPT_MINUTES;
  const distMiles = inv.appointment?.clock_in_distance_miles ?? null;
  const isFarClockIn = distMiles != null && distMiles > 1;

  return (
    <tr
      className={`hover:bg-muted/30 transition-colors cursor-pointer ${isLong ? "bg-amber-50/40" : isFarClockIn ? "bg-red-50/40" : ""}`}
      onClick={() => navigate(`/appointments/${inv.appointment_id}`)}
    >
      <td className="px-4 py-3 font-medium">{inv.interpreter?.name ?? "—"}</td>
      <td className="px-4 py-3">{inv.appointment?.patient.name ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{inv.appointment?.po_number ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {dt ? formatInTz(dt, { dateStyle: "medium", timeStyle: "short" }, tz) : "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          {inv.appointment?.clock_in_time
            ? formatInTz(inv.appointment.clock_in_time, { timeStyle: "short" }, tz)
            : "—"}
          {" → "}
          {inv.appointment?.clock_out_time
            ? formatInTz(inv.appointment.clock_out_time, { timeStyle: "short" }, tz)
            : "—"}
          {isFarClockIn && (
            <span
              title={`Clocked in ${distMiles!.toFixed(2)} mi from clinic`}
              className="inline-flex items-center gap-0.5 rounded-full bg-red-100 border border-red-400 px-1.5 py-0 text-[10px] font-semibold text-red-700"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {`${distMiles!.toFixed(1)}mi`}
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="inline-flex items-center gap-1.5 justify-end">
          {isLong && (
            <span
              title={`${durMins} min actual — exceeds 2-hour standard`}
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 border border-amber-400 px-1.5 py-0 text-[10px] font-semibold text-amber-700"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {t("invoices.long_appt_flag")}
            </span>
          )}
          {inv.billable_minutes} min
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">${inv.amount.toFixed(2)}</td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={inv.status} />
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {inv.status === "submitted" && (
          <Button size="sm" onClick={onApprove}>
            <CheckCircle className="mr-1 h-3.5 w-3.5" />
            {t("invoices.approve")}
          </Button>
        )}
        {inv.status === "approved" && inv.approved_by && (
          <span className="text-xs text-muted-foreground">{t("invoices.approved_by")} {inv.approved_by.name}</span>
        )}
      </td>
    </tr>
  );
}

function ApproveDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation();
  const approve = useApproveInvoice(invoice.id);
  const durMins = actualDurationMins(invoice.appointment);
  const isLong = durMins != null && durMins > LONG_APPT_MINUTES;
  const distMiles = invoice.appointment?.clock_in_distance_miles ?? null;
  const isFarClockIn = distMiles != null && distMiles > 1;

  async function handleApprove() {
    try {
      await approve.mutateAsync({});
      toast({ title: t("invoices.approved_success") });
      onClose();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("invoices.confirm_approval")}</DialogTitle>
        </DialogHeader>

        {isFarClockIn && (
          <div className="flex items-start gap-2 rounded-md border border-red-400 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p>
              <span className="font-semibold">{t("invoices.far_clockin_warning_title")}</span>
              {" — "}
              {t("invoices.far_clockin_warning_body", { miles: distMiles!.toFixed(2) })}
            </p>
          </div>
        )}
        {isLong && (
          <div className="flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              <span className="font-semibold">{t("invoices.long_appt_warning_title")}</span>
              {" — "}
              {t("invoices.long_appt_warning_body", { minutes: durMins })}
            </p>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">{t("invoices.interpreter")}:</span> {invoice.interpreter?.name}</p>
          <p><span className="text-muted-foreground">{t("appointments.patient")}:</span> {invoice.appointment?.patient.name}</p>
          <p>
            <span className="text-muted-foreground">{t("invoices.duration")}:</span>{" "}
            <span className={isLong ? "font-semibold text-amber-700" : ""}>{invoice.billable_minutes} min</span>
          </p>
          <p className="text-lg font-bold">${invoice.amount.toFixed(2)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleApprove} disabled={approve.isPending}>
            <CheckCircle className="mr-1 h-4 w-4" />
            {t("invoices.approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: "submitted" | "approved" }) {
  const { t } = useTranslation();
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle className="h-3 w-3" />
        {t("invoices.status_approved")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
      <Clock className="h-3 w-3" />
      {t("invoices.status_submitted")}
    </span>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number | string; accent?: "orange" }) {
  return (
    <div className={`rounded-lg border p-4 ${accent === "orange" ? "border-orange-200 bg-orange-50" : "bg-card"}`}>
      <p className={`text-2xl font-bold ${accent === "orange" ? "text-orange-700" : ""}`}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
