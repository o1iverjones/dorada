import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useInsuranceAgencies(params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["insurance-agencies", params],
    queryFn: () => api.get<{ data: unknown[] }>(`/insurance-agencies${query ? `?${query}` : ""}`),
  });
}

export function useInsuranceAgency(id: string) {
  return useQuery({
    queryKey: ["insurance-agencies", id],
    queryFn: () => api.get(`/insurance-agencies/${id}`),
    enabled: !!id,
  });
}

export function useCreateInsuranceAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/insurance-agencies", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-agencies"] }),
  });
}

export function useUpdateInsuranceAgency(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch(`/insurance-agencies/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-agencies", id] });
      qc.invalidateQueries({ queryKey: ["insurance-agencies"] });
    },
  });
}
