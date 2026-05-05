import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useAppointments(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => api.get<{ data: unknown[]; pagination: unknown }>(`/appointments${query ? `?${query}` : ""}`),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointments", id],
    queryFn: () => api.get(`/appointments/${id}`),
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/appointments", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/appointments/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useCancelAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useOfferAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/appointments/${id}/offer`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments", id] }),
  });
}

export function useFollowUpDrafts(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["follow-up-drafts", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/appointments/follow-up-drafts${query ? `?${query}` : ""}`),
  });
}

export function useReviewFollowUpDraft(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/appointments/follow-up-drafts/${draftId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follow-up-drafts"] }),
  });
}
