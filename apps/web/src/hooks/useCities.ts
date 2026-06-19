import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface City { id: string; name: string; created_at: string; }

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: () => api.get<City[]>("/cities"),
  });
}

export function useCreateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<City>("/cities", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cities"] });
      qc.invalidateQueries({ queryKey: ["interpreter-cities"] });
    },
  });
}

export function useRenameCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<City>(`/cities/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cities"] });
      qc.invalidateQueries({ queryKey: ["interpreter-cities"] });
      qc.invalidateQueries({ queryKey: ["interpreters"] });
    },
  });
}

export function useDeleteCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cities"] });
      qc.invalidateQueries({ queryKey: ["interpreter-cities"] });
      qc.invalidateQueries({ queryKey: ["interpreters"] });
    },
  });
}
