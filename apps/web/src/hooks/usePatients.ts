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

export function usePatientActivity(id: string) {
  return useQuery({
    queryKey: ["patients", id, "activity"],
    queryFn: () => api.get<unknown[]>(`/patients/${id}/activity`),
    enabled: !!id,
  });
}

export function usePatientNotes(id: string) {
  return useQuery({
    queryKey: ["patients", id, "notes"],
    queryFn: () => api.get<unknown[]>(`/patients/${id}/admin-notes`),
    enabled: !!id,
  });
}

export function useAddPatientNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, image_url }: { content: string; image_url?: string | null }) =>
      api.post(`/patients/${id}/admin-notes`, { content, image_url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients", id, "notes"] }),
  });
}

export function useUploadPatientNoteImage(id: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile<{ url: string }>(`/patients/${id}/note-image`, fd);
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
