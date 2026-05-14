import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Socket } from "socket.io-client";
import { getSocket } from "../../lib/socket.js";
import { useQueryClient } from "@tanstack/react-query";
import { useConversations, useMessages, useSendMessage } from "../../hooks/useMessages.js";
import { api } from "../../lib/api.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { cn } from "../../lib/utils.js";
import { Send } from "lucide-react";

interface Message {
  id: string;
  body: string;
  sender_type: "admin" | "interpreter";
  sender: { id: string; name: string };
  sent_at: string;
  read_at: string | null;
}

interface Conversation {
  id: string;
  interpreter: { id: string; name: string };
  last_message: { body: string; sent_at: string; sender_type: string } | null;
  unread_count: number;
}


export function MessagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  // Ref so the socket handler always sees the current selected conversation
  const selectedIdRef = useRef<string | null>(null);

  const { data: conversations, isLoading } = useConversations();
  const { data: thread } = useMessages(selectedId ?? "");
  const send = useSendMessage(selectedId ?? "");

  const convs = (conversations?.data ?? []) as Conversation[];

  const recentConvs = convs
    .filter((c) => c.last_message !== null)
    .sort((a, b) => new Date(b.last_message!.sent_at).getTime() - new Date(a.last_message!.sent_at).getTime());
  const otherConvs = convs.filter((c) => c.last_message === null);
  const selected = convs.find((c) => c.interpreter.id === selectedId);

  // Merge REST messages with real-time messages (deduplicated by id)
  const restMessages = (thread?.data ?? []) as Message[];
  const allMessages = [
    ...restMessages,
    ...realtimeMessages.filter((rm) => !restMessages.some((m) => m.id === rm.id)),
  ].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  // Keep ref in sync so socket handlers always see the current conversation
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  function markConversationRead(interpreterId: string) {
    // Optimistic update — clear the badge immediately in the cache
    qc.setQueryData(["conversations"], (old: unknown) => {
      if (!old || typeof old !== "object") return old;
      const data = (old as { data: Array<{ interpreter: { id: string }; unread_count: number }> }).data;
      return {
        ...(old as object),
        data: data.map((conv) =>
          conv.interpreter.id === interpreterId ? { ...conv, unread_count: 0 } : conv,
        ),
      };
    });
    // Persist to server and refresh authoritative data
    api.post(`/messages/conversations/${interpreterId}/read`, {})
      .then(() => qc.refetchQueries({ queryKey: ["conversations"] }))
      .catch((err) => console.error("[markRead] failed:", err));
  }

  // Socket.io setup — empty deps so handlers are registered once
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const handleNewMessage = (msg: Message) => {
      setRealtimeMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setPeerTyping(false);
      if (msg.sender_type === "interpreter" && selectedIdRef.current) {
        markConversationRead(selectedIdRef.current);
      }
    };

    const handleTyping = (data: { sender_type: string; is_typing: boolean }) => {
      if (data.sender_type !== "admin") setPeerTyping(data.is_typing);
    };

    // Re-join the active room after a reconnect (socket loses room membership on disconnect)
    const handleReconnect = () => {
      const id = selectedIdRef.current;
      if (id) socket.emit("join_conversation", { interpreter_id: id });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("connect", handleReconnect);
    };
  // qc is stable; intentionally omitting from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Join socket room + mark read when conversation is selected
  useEffect(() => {
    if (!selectedId) return;
    setRealtimeMessages([]);
    setPeerTyping(false);
    markConversationRead(selectedId);
    socketRef.current?.emit("join_conversation", { interpreter_id: selectedId });
    return () => {
      socketRef.current?.emit("leave_conversation", { interpreter_id: selectedId });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, peerTyping]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (!selectedId || !socketRef.current) return;
    socketRef.current.emit("typing_start", { interpreter_id: selectedId });
    if (typingTimer) clearTimeout(typingTimer);
    const timer = setTimeout(() => {
      socketRef.current?.emit("typing_stop", { interpreter_id: selectedId });
    }, 2000);
    setTypingTimer(timer);
  }, [selectedId, typingTimer]);

  async function handleSend() {
    if (!draft.trim() || !selectedId) return;
    if (typingTimer) clearTimeout(typingTimer);
    socketRef.current?.emit("typing_stop", { interpreter_id: selectedId });
    try {
      await send.mutateAsync({ body: draft });
      setDraft("");
    } catch {}
  }

  return (
    <div>
      <PageHeader title={t("messages.title")} />
      <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-md border">
        {/* Conversation list */}
        <div className="flex w-72 shrink-0 flex-col border-r">
          <div className="border-b p-3">
            <p className="text-sm font-medium text-muted-foreground">{t("messages.conversations")}</p>
          </div>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <ul className="overflow-y-auto">
              {recentConvs.length > 0 && (
                <>
                  <li className="border-b px-3 py-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("messages.recent")}</p>
                  </li>
                  {recentConvs.map((conv) => (
                    <li key={conv.interpreter.id}>
                      <button
                        onClick={() => setSelectedId(conv.interpreter.id)}
                        className={cn(
                          "w-full p-3 text-left text-sm transition-colors hover:bg-accent",
                          selectedId === conv.interpreter.id && "bg-accent",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{conv.interpreter.name}</p>
                          {conv.unread_count > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-muted-foreground">
                          {conv.last_message?.body ?? ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </>
              )}
              {otherConvs.length > 0 && (
                <>
                  <li className={cn("px-3 py-1.5", recentConvs.length > 0 && "border-t")}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("messages.all_interpreters")}</p>
                  </li>
                  {otherConvs.map((conv) => (
                    <li key={conv.interpreter.id}>
                      <button
                        onClick={() => setSelectedId(conv.interpreter.id)}
                        className={cn(
                          "w-full p-3 text-left text-sm transition-colors hover:bg-accent",
                          selectedId === conv.interpreter.id && "bg-accent",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{conv.interpreter.name}</p>
                        </div>
                        <p className="truncate text-muted-foreground">{t("messages.no_messages")}</p>
                      </button>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="flex flex-1 flex-col">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              {t("messages.select_conversation")}
            </div>
          ) : (
            <>
              <div className="border-b p-3">
                <p className="font-medium">{selected?.interpreter.name}</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {allMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.sender_type === "admin" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-xs rounded-lg px-3 py-2 text-sm",
                        msg.sender_type === "admin" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <p>{msg.body}</p>
                      <p className={cn("mt-1 text-xs", msg.sender_type === "admin" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {new Date(msg.sent_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {peerTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {t("messages.typing")}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="border-t p-3">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    placeholder={t("messages.placeholder")}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
