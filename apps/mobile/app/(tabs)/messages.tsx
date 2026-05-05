import { useState, useRef } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../src/lib/api";
import { Ionicons } from "@expo/vector-icons";

interface Message {
  id: string;
  body: string;
  sender_type: "interpreter" | "admin";
  created_at: string;
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["messages-interpreter"],
    queryFn: () => api.get<{ data: Message[] }>("/messages/me"),
    refetchInterval: 10_000,
  });

  const send = useMutation({
    mutationFn: (body: unknown) => api.post("/messages/me", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages-interpreter"] });
      setDraft("");
    },
  });

  const messages = data?.data ?? [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={<Text style={styles.empty}>{t("messages.no_messages")}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.sender_type === "interpreter" ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.bubbleText, item.sender_type === "interpreter" && styles.myBubbleText]}>{item.body}</Text>
            <Text style={[styles.bubbleTime, item.sender_type === "interpreter" && styles.myBubbleTime]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
          onPress={() => send.mutate({ body: draft })}
          disabled={!draft.trim() || send.isPending}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12 },
  myBubble: { alignSelf: "flex-end", backgroundColor: "#3b82f6" },
  theirBubble: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  bubbleText: { fontSize: 15, color: "#0f172a" },
  myBubbleText: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: "#94a3b8", marginTop: 4, textAlign: "right" },
  myBubbleTime: { color: "rgba(255,255,255,0.7)" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 48 },
  inputRow: { flexDirection: "row", padding: 12, gap: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0", alignItems: "flex-end" },
  input: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { backgroundColor: "#3b82f6", borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});
