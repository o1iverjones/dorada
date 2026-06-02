import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead, useOrgTimezone } from "../../hooks/useSettings.js";
import { getSocket } from "../../lib/socket.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Card, CardContent } from "../../components/ui/card.js";
import { Button } from "../../components/ui/button.js";
import { AlertTriangle, CheckCheck } from "lucide-react";
import { formatInTz } from "../../lib/timezone.js";

export function AlertsPage() {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data: alertsData } = useAlerts();
  const markAlertRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const qc = useQueryClient();

  const alerts = (alertsData?.data ?? []) as Array<Record<string, unknown>>;
  const unreadCount = alertsData?.unread_count ?? 0;

  // Real-time: pick up new alerts via socket
  useEffect(() => {
    const socket = getSocket();
    const handler = () => { qc.invalidateQueries({ queryKey: ["alerts"] }); };
    socket.on("alert:new", handler);
    return () => { socket.off("alert:new", handler); };
  }, [qc]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.alerts")}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {t("dashboard.mark_all_read")}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {!alerts.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("dashboard.no_alerts")}</p>
          ) : (
            <ul className="divide-y">
              {alerts.map((alert) => {
                const isUnread = !alert.is_read as boolean;
                const apptId = alert.appointment_id as string | null;
                return (
                  <li
                    key={alert.id as string}
                    className={`flex items-start justify-between gap-4 px-5 py-4 text-sm transition-colors ${isUnread ? "bg-red-50" : ""}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${isUnread ? "text-red-500" : "text-muted-foreground"}`}
                      />
                      <div className="min-w-0">
                        <p className={`leading-snug ${isUnread ? "font-medium" : "text-muted-foreground"}`}>
                          {alert.message as string}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatInTz(alert.created_at as string, { dateStyle: "medium", timeStyle: "short" }, tz)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {apptId && (
                        <Link
                          to={`/appointments/${apptId}`}
                          className="whitespace-nowrap text-xs font-bold text-primary hover:underline"
                        >
                          {t("dashboard.view_appointment")}
                        </Link>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => markAlertRead.mutate(alert.id as string)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={t("dashboard.mark_read")}
                          disabled={markAlertRead.isPending}
                        >
                          <CheckCheck className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
