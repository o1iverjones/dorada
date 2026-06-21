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

export function useClinicDoctors(clinicId: string) {
  return useQuery({
    queryKey: ["clinics", clinicId, "doctors"],
    queryFn: () => api.get<Array<{ id: string; name: string }>>(`/clinics/${clinicId}/doctors`),
    enabled: !!clinicId,
  });
}

export function useAddClinicDoctor(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post(`/clinics/${clinicId}/doctors`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinics", clinicId, "doctors"] });
      qc.invalidateQueries({ queryKey: ["clinics", clinicId] });
    },
  });
}

export function useRemoveClinicDoctor(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doctorId: string) => api.delete(`/clinics/${clinicId}/doctors/${doctorId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinics", clinicId, "doctors"] });
      qc.invalidateQueries({ queryKey: ["clinics", clinicId] });
    },
  });
}
