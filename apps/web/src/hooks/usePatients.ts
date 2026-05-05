import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function usePatients(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/patients${query ? `?${query}` : ""}`),
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
