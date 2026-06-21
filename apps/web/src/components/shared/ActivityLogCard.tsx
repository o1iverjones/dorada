import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { useEntityActivity, type EntityType } from "../../hooks/useEntityNotes.js";
import { ClipboardList } from "lucide-react";

interface ActivityLogCardProps {
  entity: EntityType;
  id: string;
}

interface ActivityRow {
  id: string;
  admin_name: string;
  action: string;
  detail: string | null;
  created_at: string;
}

export function ActivityLogCard({ entity, id }: ActivityLogCardProps) {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data } = useEntityActivity(entity, id);
  const entries = (data as ActivityRow[] | undefined) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> {t("dashboard.activity_log")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("appointments.no_activity")}</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background border-border" />
                <p className="text-xs text-muted-foreground">
                  {formatInTz(entry.created_at, { dateStyle: "medium", timeStyle: "short" }, tz)}
                  {" · "}
                  <span className="font-medium text-foreground">{entry.admin_name}</span>
                </p>
                <p className="text-sm mt-0.5 capitalize">
                  {entry.action.replace(/_/g, " ")}
                  {entry.detail ? <span className="text-muted-foreground"> — {entry.detail}</span> : null}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
