import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConversations, useMessages, useSendMessage } from "../../hooks/useMessages.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { cn } from "../../lib/utils.js";
import { Send } from "lucide-react";

export function MessagesPage() {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: conversations, isLoading } = useConversations();
  const { data: thread } = useMessages(selectedId ?? "");
  const send = useSendMessage(selectedId ?? "");

  async function handleSend() {
    if (!draft.trim() || !selectedId) return;
    try {
      await send.mutateAsync({ body: draft });
      setDraft("");
    } catch {}
  }

  const convs = (conversations?.data ?? []) as Array<Record<string, unknown>>;
  const msgs = (thread?.data ?? []) as Array<Record<string, unknown>>;
  const selected = convs.find((c) => c.interpreter_id === selectedId);

  return (
    <div>
      <PageHeader title={t("messages.title")} />
      <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-md border">
        {/* Conversation list */}
        <div className="w-72 shrink-0 border-r">
          <div className="border-b p-3">
            <p className="text-sm font-medium text-muted-foreground">{t("messages.conversations")}</p>
          </div>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <ul>
              {convs.map((conv) => (
                <li key={conv.interpreter_id as string}>
                  <button
                    onClick={() => setSelectedId(conv.interpreter_id as string)}
                    className={cn(
                      "w-full p-3 text-left text-sm transition-colors hover:bg-accent",
                      selectedId === conv.interpreter_id && "bg-accent",
                    )}
                  >
                    <p className="font-medium">{conv.interpreter_name as string}</p>
                    <p className="truncate text-muted-foreground">{conv.last_message as string ?? ""}</p>
                  </button>
                </li>
              ))}
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
                <p className="font-medium">{selected?.interpreter_name as string}</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {msgs.map((msg) => (
                  <div
                    key={msg.id as string}
                    className={cn(
                      "flex",
                      msg.sender_type === "admin" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-xs rounded-lg px-3 py-2 text-sm",
                        msg.sender_type === "admin"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <p>{msg.body as string}</p>
                      <p className={cn("mt-1 text-xs", msg.sender_type === "admin" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {new Date(msg.created_at as string).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
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
