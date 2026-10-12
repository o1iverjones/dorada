import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Interpreter {
  id: string;
  name: string;
  phone: string;
  organization_id: string;
}

interface AuthState {
  interpreter: Interpreter | null;
  setInterpreter: (i: Interpreter) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      interpreter: null,
      setInterpreter: (interpreter) => set({ interpreter }),
      logout: () => set({ interpreter: null }),
    }),
    { name: "dorada-pwa-auth" },
  ),
);
