import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useInsuranceCompanies(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["insurance-companies", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/insurance-companies${query ? `?${query}` : ""}`),
  });
}

export function useInsuranceCompany(id: string) {
  return useQuery({
    queryKey: ["insurance-companies", id],
    queryFn: () => api.get(`/insurance-companies/${id}`),
    enabled: !!id,
  });
}

export function useCreateInsuranceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/insurance-companies", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-companies"] }),
  });
}

export function useUpdateInsuranceCompany(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/insurance-companies/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-companies", id] });
      qc.invalidateQueries({ queryKey: ["insurance-companies"] });
    },
  });
}

export function useInsuranceCompanyActivity(id: string) {
  return useQuery({
    queryKey: ["insurance-companies", id, "activity"],
    queryFn: () => api.get<unknown[]>(`/insurance-companies/${id}/activity`),
    enabled: !!id,
  });
}

export function useInsuranceCompanyNotes(id: string) {
  return useQuery({
    queryKey: ["insurance-companies", id, "notes"],
    queryFn: () => api.get<unknown[]>(`/insurance-companies/${id}/admin-notes`),
    enabled: !!id,
  });
}

export function useAddInsuranceCompanyNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, image_url }: { content: string; image_url?: string | null }) =>
      api.post(`/insurance-companies/${id}/admin-notes`, { content, image_url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-companies", id, "notes"] }),
  });
}

export function useUploadInsuranceCompanyNoteImage(id: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile<{ url: string }>(`/insurance-companies/${id}/note-image`, fd);
    },
  });
}
