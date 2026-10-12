import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Send, Image as ImageIcon, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";

export default function MessagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const interpreter = useAuthStore((s) => s.interpreter);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convId = interpreter?.id ?? "";

  const { data, refetch } = useQuery({
    queryKey: ["messages", convId],
    queryFn: () => api.get<{ data: unknown[] }>(`/messages/conversations/${convId}`),
    enabled: !!convId,
    refetchInterval: 3000,
  });

  const sendMsg = useMutation({
    mutationFn: (body: { content: string }) => api.post(`/messages/conversations/${convId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      setText("");
    },
  });

  const uploadImg = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.uploadFile(`/messages/conversations/${convId}/media`, formData);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", convId] }),
  });

  // Mark as read on mount
  useEffect(() => {
    if (convId) api.post(`/messages/conversations/${convId}/read`, {}).catch(() => {});
  }, [convId]);

  const messages = ((data?.data ?? []) as Array<Record<string, unknown>>).slice().reverse();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMsg.mutate({ content: trimmed });
  }

  function handleImageUpload() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadImg.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="font-semibold">{t("nav.messages")}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-[var(--color-text-subtle)] mt-12">{t("messages.no_messages")}</p>
        )}
        {messages.map((msg) => {
          const isMe = (msg.sender_type as string) === "interpreter";
          const imageUrl = msg.image_url as string | null;
          const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
          const serverRoot = apiBase.replace(/\/api\/v1\/?$/, "");
          return (
            <div key={msg.id as string} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                isMe ? "bg-forest text-white rounded-br-sm" : "bg-surface border border-[var(--color-border)] rounded-bl-sm"
              }`}>
                {imageUrl && (
                  <img
                    src={imageUrl.startsWith("http") ? imageUrl : `${serverRoot}${imageUrl}`}
                    className="rounded-lg mb-2 max-w-full"
                    style={{ maxHeight: 200 }}
                  />
                )}
                {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content as string}</p>}
                <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-[var(--color-text-subtle)]"}`}>
                  {new Date(msg.created_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="bg-surface border-t border-[var(--color-border)] px-4 py-3 safe-bottom flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        <button type="button" onClick={handleImageUpload} disabled={uploadImg.isPending} className="p-2 text-[var(--color-text-muted)] active:text-forest">
          {uploadImg.isPending ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("messages.type_message")}
          className="flex-1 border border-[var(--color-border)] rounded-full px-4 py-2.5 text-sm outline-none focus:border-forest"
        />
        <button
          type="submit"
          disabled={sendMsg.isPending || !text.trim()}
          className="p-2.5 bg-forest text-white rounded-full disabled:opacity-40 active:opacity-80"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
