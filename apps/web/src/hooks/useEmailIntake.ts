import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useEmailIntakeLogs(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["email-intake-logs", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/email-intake/logs${query ? `?${query}` : ""}`),
  });
}

export function useEmailIntakeLog(id: string) {
  return useQuery({
    queryKey: ["email-intake-logs", id],
    queryFn: () => api.get(`/email-intake/logs/${id}`),
    enabled: !!id,
  });
}

export function useEmailIntakeDrafts(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["email-intake-drafts", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/email-intake/drafts${query ? `?${query}` : ""}`),
  });
}

export function useReviewEmailIntakeDraft(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/email-intake/drafts/${draftId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-intake-drafts"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useRetryConfirmation(logId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/email-intake/logs/${logId}/retry-confirmation`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-intake-logs", logId] }),
  });
}
