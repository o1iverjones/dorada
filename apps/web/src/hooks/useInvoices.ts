import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useInvoices(params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : "";
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => api.get<{ data: unknown[]; pagination: unknown }>(`/invoices${query ? `?${query}` : ""}`),
  });
}

export function useInvoiceStats(enabled = true) {
  return useQuery({
    queryKey: ["invoices", "stats"],
    queryFn: () => api.get<{ submitted_count: number }>("/invoices/stats"),
    refetchInterval: 30_000,
    enabled,
  });
}

export function useApproveInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { notes?: string }) => api.patch(`/invoices/${id}/approve`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
