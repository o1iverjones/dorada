import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<{ data: unknown[] }>("/messages/conversations"),
    refetchInterval: 30_000,
  });
}

export function useUnreadMessageCount() {
  const { data } = useConversations();
  const convs = (data?.data ?? []) as Array<{ unread_count: number }>;
  return convs.reduce((sum, c) => sum + c.unread_count, 0);
}

export function useMessages(interpreterId: string) {
  return useQuery({
    queryKey: ["messages", interpreterId],
    queryFn: () => api.get<{ data: unknown[] }>(`/messages/conversations/${interpreterId}`),
    enabled: !!interpreterId,
    refetchInterval: 8_000,
  });
}

export function useSendMessage(interpreterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post(`/messages/conversations/${interpreterId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkRead(interpreterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/messages/conversations/${interpreterId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
