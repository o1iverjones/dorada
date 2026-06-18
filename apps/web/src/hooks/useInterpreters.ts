import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useInterpreters(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["interpreters", params],
    queryFn: () => api.get<{ data: unknown[]; pagination: unknown }>(`/interpreters${query ? `?${query}` : ""}`),
  });
}

export function useInterpreter(id: string) {
  return useQuery({
    queryKey: ["interpreters", id],
    queryFn: () => api.get(`/interpreters/${id}`),
    enabled: !!id,
  });
}

export function useCreateInterpreter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/interpreters", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interpreters"] }),
  });
}

export function useUpdateInterpreter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/interpreters/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interpreters", id] });
      qc.invalidateQueries({ queryKey: ["interpreters"] });
    },
  });
}

export function useInterpreterCities() {
  return useQuery({
    queryKey: ["interpreter-cities"],
    queryFn: () => api.get<string[]>("/interpreters/cities"),
    staleTime: 30_000,
  });
}

export function useDeactivateInterpreter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/interpreters/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interpreters"] }),
  });
}
