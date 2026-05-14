import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useClinics(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["clinics", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/clinics${query ? `?${query}` : ""}`),
  });
}

export function useClinic(id: string) {
  return useQuery({
    queryKey: ["clinics", id],
    queryFn: () => api.get(`/clinics/${id}`),
    enabled: !!id,
  });
}

export function useCreateClinic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/clinics", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinics"] }),
  });
}

export function useUpdateClinic(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/clinics/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinics", id] });
      qc.invalidateQueries({ queryKey: ["clinics"] });
    },
  });
}

export function useClinicActivity(id: string) {
  return useQuery({
    queryKey: ["clinics", id, "activity"],
    queryFn: () => api.get<unknown[]>(`/clinics/${id}/activity`),
    enabled: !!id,
  });
}

export function useClinicNotes(id: string) {
  return useQuery({
    queryKey: ["clinics", id, "notes"],
    queryFn: () => api.get<unknown[]>(`/clinics/${id}/admin-notes`),
    enabled: !!id,
  });
}

export function useAddClinicNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.post(`/clinics/${id}/admin-notes`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinics", id, "notes"] });
      qc.invalidateQueries({ queryKey: ["clinics", id, "activity"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
    },
  });
}

export function useSetClinicInterpreterBlocks(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interpreterIds: string[]) => api.put(`/clinics/${id}/interpreter-blocks`, { interpreter_ids: interpreterIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinics", id] }),
  });
}

export function useClinicInterpreterNotes(id: string) {
  return useQuery({
    queryKey: ["clinics", id, "interpreter-notes"],
    queryFn: () => api.get<unknown[]>(`/clinics/${id}/interpreter-notes`),
    enabled: !!id,
  });
}

export function useCreateClinicInterpreterNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; type: string }) => api.post(`/clinics/${id}/interpreter-notes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinics", id, "interpreter-notes"] }),
  });
}

export function useUpdateClinicInterpreterNote(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: { content?: string; type?: string; is_active?: boolean } }) =>
      api.patch(`/clinics/${clinicId}/interpreter-notes/${noteId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinics", clinicId, "interpreter-notes"] }),
  });
}

export function useDeleteClinicInterpreterNote(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api.delete(`/clinics/${clinicId}/interpreter-notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinics", clinicId, "interpreter-notes"] }),
  });
}
