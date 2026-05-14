import { create } from "zustand";

interface MessagesState {
  hasUnread: boolean;
  setHasUnread: (value: boolean) => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  hasUnread: false,
  setHasUnread: (value) => set({ hasUnread: value }),
}));
