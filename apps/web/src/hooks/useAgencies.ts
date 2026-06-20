import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useAgencies(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["agencies", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/agencies${query ? `?${query}` : ""}`),
  });
}

export function useAgency(id: string) {
  return useQuery({
    queryKey: ["agencies", id],
    queryFn: () => api.get(`/agencies/${id}`),
    enabled: !!id,
  });
}

export function useCreateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/agencies", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agencies"] }),
  });
}

export function useUpdateAgency(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/agencies/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies", id] });
      qc.invalidateQueries({ queryKey: ["agencies"] });
    },
  });
}

export function useAgencyActivity(id: string) {
  return useQuery({
    queryKey: ["agencies", id, "activity"],
    queryFn: () => api.get<unknown[]>(`/agencies/${id}/activity`),
    enabled: !!id,
  });
}

export function useAgencyNotes(id: string) {
  return useQuery({
    queryKey: ["agencies", id, "notes"],
    queryFn: () => api.get<unknown[]>(`/agencies/${id}/admin-notes`),
    enabled: !!id,
  });
}

export function useAddAgencyNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, image_url }: { content: string; image_url?: string | null }) =>
      api.post(`/agencies/${id}/admin-notes`, { content, image_url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agencies", id, "notes"] }),
  });
}

export function useUploadAgencyNoteImage(id: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile<{ url: string }>(`/agencies/${id}/note-image`, fd);
    },
  });
}
