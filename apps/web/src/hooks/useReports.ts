import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

/** Format a YYYY-MM-DD string as "Jan 1, 2026". */
function fmtDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Build a human-readable subtitle for a report history entry. */
export function buildReportLabel(
  type: string,
  filters: Record<string, unknown>,
  interpreterMap: Record<string, string>,
): string {
  const parts: string[] = [];

  // Interpreter scope
  if (type === "interpreter_compensation" || type === "interpreter_performance") {
    const ids = (filters["interpreter_ids"] as string[] | undefined) ?? [];
    if (ids.length === 1 && interpreterMap[ids[0]!]) {
      parts.push(interpreterMap[ids[0]!]!);
    } else if (ids.length > 1) {
      parts.push(`${ids.length} interpreters`);
    } else {
      parts.push("All interpreters");
    }
  }

  // Date range
  const from = filters["date_from"] as string | undefined;
  const to   = filters["date_to"]   as string | undefined;
  if (from && to) {
    parts.push(`${fmtDate(from)} – ${fmtDate(to)}`);
  } else if (from) {
    parts.push(`From ${fmtDate(from)}`);
  } else if (to) {
    parts.push(`Through ${fmtDate(to)}`);
  }

  return parts.join(" · ");
}

/** Build a descriptive filename for a report download. */
export function buildReportFilename(
  type: string,
  format: string,
  filters: Record<string, unknown>,
  interpreterMap: Record<string, string>, // id → name
): string {
  const dateFrom = (filters["date_from"] as string | undefined) ?? "";
  const dateTo   = (filters["date_to"]   as string | undefined) ?? "";

  let subject = "";
  if (type === "interpreter_compensation" || type === "interpreter_performance") {
    const ids = (filters["interpreter_ids"] as string[] | undefined) ?? [];
    if (ids.length === 1 && interpreterMap[ids[0]!]) {
      subject = `_${interpreterMap[ids[0]!]!.replace(/\s+/g, "-")}`;
    } else if (ids.length > 1) {
      subject = "_multiple-interpreters";
    } else {
      subject = "_all-interpreters";
    }
  }

  const datePart = dateFrom || dateTo ? `_${dateFrom}_${dateTo}` : "";
  const typeSlug = type.replace(/_/g, "-");
  return `${typeSlug}${subject}${datePart}.${format}`;
}

/**
 * Fetch a report file via the authenticated API client and trigger a browser download.
 * Works for both local dev URLs (/api/v1/reports/:id/download) and GCS signed URLs.
 */
export async function downloadReport(downloadUrl: string, filename: string): Promise<void> {
  // GCS signed URLs are fully-qualified and already public — fetch directly
  // Local dev URLs start with /api/v1 and need the auth header
  const isLocal = downloadUrl.startsWith("/");
  let blob: Blob;

  if (isLocal) {
    const token = localStorage.getItem("dorada_access_token");
    const res = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    blob = await res.blob();
  } else {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    blob = await res.blob();
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/reports", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-jobs"] }),
  });
}

export function useReportJob(jobId: string) {
  return useQuery({
    queryKey: ["report-jobs", jobId],
    queryFn: () => api.get(`/reports/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string } | undefined;
      return data?.status === "completed" || data?.status === "failed" ? false : 3000;
    },
  });
}

export function useReportJobs() {
  return useQuery({
    queryKey: ["report-jobs"],
    queryFn: () => api.get<{ data: unknown[] }>("/reports"),
  });
}
