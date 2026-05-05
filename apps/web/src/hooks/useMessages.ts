import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<{ data: unknown[] }>("/messages/conversations"),
    refetchInterval: 15_000,
  });
}

export function useMessages(interpreterId: string) {
  return useQuery({
    queryKey: ["messages", interpreterId],
    queryFn: () => api.get<{ data: unknown[] }>(`/messages/${interpreterId}`),
    enabled: !!interpreterId,
    refetchInterval: 5_000,
  });
}

export function useSendMessage(interpreterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/messages/${interpreterId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", interpreterId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
