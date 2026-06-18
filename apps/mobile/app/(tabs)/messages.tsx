import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/auth";
import { useMessagesStore } from "../../src/store/messages";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../src/theme";

interface Message {
  id: string;
  body: string;
  image_url: string | null;
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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
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
        const sorted = [...res.data].reverse();
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
      setImageUri(null);
      setImageUrl(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    },
  });

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setImageUrl(null);
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
      const res = await api.uploadFile<{ url: string }>(
        `/messages/conversations/${interpreterId}/media`,
        formData
      );
      setImageUrl(res.url);
    } catch {
      setImageUri(null);
    } finally {
      setImageUploading(false);
    }
  }

  const handleSend = useCallback(() => {
    if ((!draft.trim() && !imageUrl) || send.isPending || imageUploading) return;
    send.mutate({ body: draft || " ", image_url: imageUrl });
  }, [draft, imageUrl, send, imageUploading]);

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
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.bubbleImage}
                resizeMode="cover"
              />
            ) : null}
            {item.body.trim() ? (
              <Text style={[styles.bubbleText, item.sender_type === "interpreter" && styles.myBubbleText]}>
                {item.body}
              </Text>
            ) : null}
            <Text style={[styles.bubbleTime, item.sender_type === "interpreter" && styles.myBubbleTime]}>
              {new Date(item.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        )}
      />

      {/* Image preview bar */}
      {imageUri && (
        <View style={styles.previewBar}>
          <Image source={{ uri: imageUri }} style={styles.previewThumb} resizeMode="cover" />
          {imageUploading && (
            <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 8 }} />
          )}
          {!imageUploading && (
            <TouchableOpacity
              onPress={() => { setImageUri(null); setImageUrl(null); }}
              style={styles.previewRemove}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage} disabled={imageUploading}>
          <Ionicons name="image-outline" size={22} color={C.primary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("messages.placeholder")}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, ((!draft.trim() && !imageUrl) || send.isPending || imageUploading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={(!draft.trim() && !imageUrl) || send.isPending || imageUploading}
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
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, overflow: "hidden" },
  myBubble: { alignSelf: "flex-end", backgroundColor: C.primary },
  theirBubble: { alignSelf: "flex-start", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  bubbleImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  bubbleText: { fontSize: 15, color: C.text },
  myBubbleText: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: C.textSubtle, marginTop: 4, textAlign: "right" },
  myBubbleTime: { color: "rgba(255,255,255,0.7)" },
  empty: { textAlign: "center", color: C.textSubtle, marginTop: 48 },
  previewBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  previewThumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  previewRemove: { position: "absolute", top: 4, left: 56, backgroundColor: "#333", borderRadius: 10 },
  inputRow: { flexDirection: "row", padding: 12, gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, alignItems: "flex-end" },
  attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, color: C.text },
  sendBtn: { backgroundColor: C.primary, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});
