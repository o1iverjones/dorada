import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/auth";
import { useMessagesStore } from "../../src/store/messages";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

interface Message {
  id: string;
  body: string;
  sender_type: "interpreter" | "admin";
  sender: { id: string; name: string };
  sent_at: string;
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { interpreter } = useAuthStore();
  const interpreterId = interpreter?.id ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const latestTimestampRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const setHasUnread = useMessagesStore((s) => s.setHasUnread);

  // Clear unread dot and mark server-side read when this screen is focused
  useFocusEffect(
    useCallback(() => {
      setHasUnread(false);
      if (interpreterId) {
        api.post(`/messages/conversations/${interpreterId}/read`, {}).catch(() => {});
      }
    }, [interpreterId, setHasUnread])
  );

  // Initial load — fetches history once, newest-first then reverses to ascending
  useEffect(() => {
    if (!interpreterId) return;
    setIsLoading(true);
    api.get<{ data: Message[] }>(`/messages/conversations/${interpreterId}`)
      .then((res) => {
        const sorted = [...res.data].reverse(); // API returns desc, display asc
        setMessages(sorted);
        latestTimestampRef.current = sorted.at(-1)?.sent_at ?? null;
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [interpreterId]);

  // 1-second polling — only fetches messages newer than the latest known timestamp
  useEffect(() => {
    if (!interpreterId) return;
    const interval = setInterval(async () => {
      if (!latestTimestampRef.current) return;
      try {
        const since = encodeURIComponent(latestTimestampRef.current);
        const res = await api.get<{ data: Message[] }>(
          `/messages/conversations/${interpreterId}?since=${since}`
        );
        if (res.data.length === 0) return;
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = res.data.filter((m) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          latestTimestampRef.current = newMsgs.at(-1)!.sent_at;
          return [...prev, ...newMsgs];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [interpreterId]);

  const send = useMutation({
    mutationFn: (body: unknown) => api.post(`/messages/conversations/${interpreterId}`, body),
    onSuccess: (newMsg: unknown) => {
      const m = newMsg as Message & { sent_at: string };
      setMessages((prev) => {
        if (prev.some((p) => p.id === m.id)) return prev;
        latestTimestampRef.current = m.sent_at;
        return [...prev, m];
      });
      setDraft("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    },
  });

  const handleSend = useCallback(() => {
    if (!draft.trim() || send.isPending) return;
    send.mutate({ body: draft });
  }, [draft, send]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          isLoading ? null : <Text style={styles.empty}>{t("messages.no_messages")}</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.sender_type === "interpreter" ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.bubbleText, item.sender_type === "interpreter" && styles.myBubbleText]}>
              {item.body}
            </Text>
            <Text style={[styles.bubbleTime, item.sender_type === "interpreter" && styles.myBubbleTime]}>
              {new Date(item.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("messages.placeholder")}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || send.isPending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || send.isPending}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  list: { padding: 16, gap: 8, flexGrow: 1, justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12 },
  myBubble: { alignSelf: "flex-end", backgroundColor: C.primary },
  theirBubble: { alignSelf: "flex-start", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 15, color: C.text },
  myBubbleText: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: C.textSubtle, marginTop: 4, textAlign: "right" },
  myBubbleTime: { color: "rgba(255,255,255,0.7)" },
  empty: { textAlign: "center", color: C.textSubtle, marginTop: 48 },
  inputRow: { flexDirection: "row", padding: 12, gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, alignItems: "flex-end" },
  input: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, color: C.text },
  sendBtn: { backgroundColor: C.primary, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});
