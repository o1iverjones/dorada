import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function usePatients(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => api.get<{ data: unknown[]; pagination: { page: number; total_pages: number; total: number; has_more: boolean } }>(`/patients${query ? `?${query}` : ""}`),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => api.get(`/patients/${id}`),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/patients", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/patients/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients", id] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

// ─── Claims ───────────────────────────────────────────────────────────────────

export function useCreateClaim(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/patients/${patientId}/claims`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients", patientId] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdateClaim(patientId: string, claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/patients/${patientId}/claims/${claimId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients", patientId] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useDeleteClaim(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (claimId: string) => api.delete(`/patients/${patientId}/claims/${claimId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients", patientId] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
