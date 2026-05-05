import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAuthStore } from "../../store/auth.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Calendar, Clock, AlertTriangle, Mail } from "lucide-react";

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const { data: todayAppts, isLoading } = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => {
      const today = new Date().toISOString().slice(0, 10);
      return api.get<{ data: unknown[] }>(`/appointments?date_from=${today}&date_to=${today}&limit=20`);
    },
  });

  const { data: pendingOffers } = useQuery({
    queryKey: ["appointments", "pending_offer"],
    queryFn: () => api.get<{ data: unknown[] }>("/appointments?status=pending_offer&limit=5"),
  });

  const { data: followUpDrafts } = useQuery({
    queryKey: ["follow-up-drafts", "pending"],
    queryFn: () => api.get<{ data: unknown[] }>("/appointments/follow-up-drafts?status=pending_review&limit=5"),
  });

  const { data: emailDrafts } = useQuery({
    queryKey: ["email-intake-drafts", "pending"],
    queryFn: () => api.get<{ data: unknown[] }>("/email-intake/drafts?status=pending_review&limit=5"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.welcome", { name: user?.name })}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Calendar className="h-5 w-5 text-primary" />}
          label={t("dashboard.todays_appointments")}
          value={todayAppts?.data.length ?? 0}
          href="/appointments"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          label={t("dashboard.pending_offers")}
          value={pendingOffers?.data.length ?? 0}
          href="/appointments?status=pending_offer"
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.todays_schedule")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : !todayAppts?.data.length ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.no_appointments_today")}</p>
            ) : (
              <ul className="space-y-2">
                {(todayAppts.data as Array<Record<string, unknown>>).map((appt) => (
                  <li key={appt.id as string} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{appt.patient_name as string}</p>
                      <p className="text-muted-foreground">{appt.clinic_name as string}</p>
                    </div>
                    <Badge variant="outline">{String(appt.status).replace(/_/g, " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
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
