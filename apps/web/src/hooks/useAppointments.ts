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
    refetchInterval: 5000, // poll every 5s so offer status updates without refresh
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/appointments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/appointments/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useCancelAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/appointments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useOfferAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/appointments/${id}/offers`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useManualConfirm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interpreter_id: string) => api.post(`/appointments/${id}/manual-confirm`, { interpreter_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useUnassignInterpreter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${id}/unassign`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useAppointmentActivity(id: string) {
  return useQuery({
    queryKey: ["appointments", id, "activity"],
    queryFn: () => api.get<unknown[]>(`/appointments/${id}/activity`),
    enabled: !!id,
  });
}

export function useAppointmentNotes(id: string) {
  return useQuery({
    queryKey: ["appointments", id, "notes"],
    queryFn: () => api.get<unknown[]>(`/appointments/${id}/admin-notes`),
    enabled: !!id,
  });
}

export function useAddAppointmentNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, image_url }: { content: string; image_url?: string | null }) =>
      api.post(`/appointments/${id}/admin-notes`, { content, image_url }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id, "notes"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useUploadAppointmentNoteImage(id: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post<{ url: string }>(`/appointments/${id}/note-image`, fd);
    },
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

export function usePatchClockTimes(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { clock_in_time?: string; patient_arrived_at?: string; clock_out_time?: string }) =>
      api.patch(`/appointments/${id}/clock-times`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments", id, "activity"] });
    },
  });
}

export function useAppointmentMedia(id: string) {
  return useQuery({
    queryKey: ["appointments", id, "media"],
    queryFn: () => api.get<Array<{ id: string; public_url: string; filename: string; mime_type: string; file_size: number; uploaded_at: string; interpreter: { name: string } }>>(`/appointments/${id}/media`),
    enabled: !!id,
  });
}

export interface BillingFields {
  billing_billed: boolean;
  billing_invoiced: boolean;
  billing_lost: boolean;
  billing_payment_under_claim: boolean;
  billing_pending_auth: boolean;
  billing_retro: boolean;
  billing_payment_status: "not_paid" | "paid";
  billing_approval_status: "pending_approval" | "approved";
}

export function usePatchBilling(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<BillingFields>) => api.patch(`/appointments/${id}/billing`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", id] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}
