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
