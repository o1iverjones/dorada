import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../../lib/socket.js";
import { Sidebar } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";
import { Toaster } from "../ui/toaster.js";

export function AppLayout() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (msg: {
      id: string;
      body: string;
      sender_type: string;
      sender: { id: string; name: string };
      sent_at: string;
      read_at: string | null;
    }) => {
      if (msg.sender_type !== "interpreter") return;

      // Update conversations list: bump unread badge + refresh last_message preview
      qc.setQueryData(["conversations"], (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const prev = old as { data: Array<{ interpreter: { id: string }; unread_count: number; last_message: unknown }> };
        return {
          ...prev,
          data: prev.data.map((conv) =>
            conv.interpreter.id === msg.sender.id
              ? {
                  ...conv,
                  unread_count: conv.unread_count + 1,
                  last_message: { body: msg.body, sent_at: msg.sent_at, sender_type: msg.sender_type },
                }
              : conv,
          ),
        };
      });

      // Append the message into the thread cache so it's immediately visible when the conversation is opened
      qc.setQueryData(["messages", msg.sender.id], (old: unknown) => {
        const prev = (old as { data: unknown[] } | undefined);
        if (!prev) return old;
        if (prev.data.some((m) => (m as { id: string }).id === msg.id)) return old;
        return { ...prev, data: [...prev.data, msg] };
      });
    };

    socket.on("new_message", handleNewMessage);
    return () => { socket.off("new_message", handleNewMessage); };
  // qc is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
