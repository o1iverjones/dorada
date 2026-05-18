import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function usePatientArrived(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/patient-arrived`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function useClockOut(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/appointments/${appointmentId}/clock-out`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function useAddShiftNotes(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/appointments/${appointmentId}/notes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function useSubmitFollowUp(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/appointments/${appointmentId}/follow-up`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function useUploadAppointmentMedia(appointmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: { uri: string; name: string; mimeType: string }) => {
      const token = await SecureStore.getItemAsync("dorada_access_token");
      const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? "https://api.dorada.com/api/v1";
      const formData = new FormData();
      formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as any);
      const res = await fetch(`${BASE_URL}/appointments/${appointmentId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error?.message ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}
