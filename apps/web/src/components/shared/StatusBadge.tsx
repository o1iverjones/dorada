import { Badge } from "../ui/badge.js";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  confirmed: "success",
  completed: "secondary",
  pending_offer: "warning",
  in_progress: "default",
  cancelled: "destructive",
  no_show: "destructive",
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
  if (status === "declined") {
    return (
      <Badge variant="outline" className="bg-gray-100 border-red-400 text-red-700">
        declined
      </Badge>
    );
  }
  const variant = STATUS_VARIANTS[status] ?? "outline";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}
