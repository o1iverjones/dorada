import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useMyAppointments(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : "";
  return useQuery({
    queryKey: ["my-appointments", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/appointments/me/appointments${query ? `?${query}` : ""}`),
  });
}

export function useAppointmentOffers() {
  return useQuery({
    queryKey: ["appointment-offers"],
    queryFn: () => api.get<{ data: unknown[] }>("/appointments/me/offers"),
    refetchInterval: 30_000,
  });
}

export function useAppointmentDetail(id: string) {
  return useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api.get<Record<string, unknown>>(`/appointments/me/${id}`),
    enabled: !!id,
  });
}

export function useConfirmOffer(appointmentId: string, offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/offers/${offerId}/confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointment-offers"] });
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
    },
  });
}

export function useDeclineOffer(appointmentId: string, offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/offers/${offerId}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment-offers"] }),
  });
}

export function useClockIn(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coords?: { lat: number; lng: number }) =>
      api.post(`/appointments/${appointmentId}/clock-in`, coords ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
  });
}

export function usePatientArrived(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/patient-arrived`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
  });
}

export function useClockOut(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/clock-out`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
  });
}

export function useAddShiftNotes(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/appointments/${appointmentId}/notes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", appointmentId] }),
  });
}

export function useSubmitFollowUp(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/appointments/${appointmentId}/follow-up`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", appointmentId] }),
  });
}

export function useUploadAppointmentMedia(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.uploadFile(`/appointments/${appointmentId}/media`, formData);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", appointmentId] }),
  });
}
