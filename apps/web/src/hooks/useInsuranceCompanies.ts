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

