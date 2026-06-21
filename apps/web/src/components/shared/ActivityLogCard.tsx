import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { useOrgTimezone } from "../../hooks/useSettings.js";
import { formatInTz } from "../../lib/timezone.js";
import { useEntityActivity, type EntityType } from "../../hooks/useEntityNotes.js";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 15;

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

function PaginationControls({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ActivityLogCard({ entity, id }: ActivityLogCardProps) {
  const { t } = useTranslation();
  const tz = useOrgTimezone();
  const { data } = useEntityActivity(entity, id);
  const entries = (data as ActivityRow[] | undefined) ?? [];

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> {t("dashboard.activity_log")}
          </CardTitle>
          <PaginationControls page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("appointments.no_activity")}</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {pageEntries.map((entry) => (
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
