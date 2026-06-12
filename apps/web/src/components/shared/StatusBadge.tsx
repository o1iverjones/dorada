import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge.js";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  confirmed: "success",
  completed: "secondary",
  pending_offer: "warning",
  in_progress: "default",
  cancelled: "destructive",
  late_cancellation: "destructive",
  no_show: "destructive",
  rescheduled: "warning",
  double_booking: "warning",
  pt_speaks_eng: "secondary",
  dr_speaks_es: "secondary",
  pending_review: "warning",
  pending_email_review: "warning",
  approved: "success",
  dismissed: "secondary",
  failed: "destructive",
  success: "success",
  active: "success",
  inactive: "secondary",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  const label = t(`appointment.status.${status}`, { defaultValue: status.replace(/_/g, " ") });

  if (status === "declined") {
    return (
      <Badge variant="outline" className="bg-gray-100 border-red-400 text-red-700">
        {label}
      </Badge>
    );
  }
  if (status === "unassigned") {
    return (
      <Badge variant="outline" className="bg-gray-100 border-gray-400 text-gray-600">
        {label}
      </Badge>
    );
  }
  const variant = STATUS_VARIANTS[status] ?? "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
