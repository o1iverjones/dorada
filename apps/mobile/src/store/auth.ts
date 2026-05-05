import { create } from "zustand";

interface Interpreter {
  id: string;
  name: string;
  phone: string;
  organization_id: string;
}

interface AuthState {
  interpreter: Interpreter | null;
  setInterpreter: (interpreter: Interpreter | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  interpreter: null,
  setInterpreter: (interpreter) => set({ interpreter }),
  logout: () => set({ interpreter: null }),
}));
