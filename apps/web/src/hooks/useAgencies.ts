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
