import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Interpreter {
  id: string;
  name: string;
  phone: string;
  organization_id: string;
}

interface AuthState {
  interpreter: Interpreter | null;
  _hasHydrated: boolean;
  setInterpreter: (interpreter: Interpreter | null) => void;
  setHasHydrated: (state: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      interpreter: null,
      _hasHydrated: false,
      setInterpreter: (interpreter) => set({ interpreter }),
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      logout: () => set({ interpreter: null }),
    }),
    {
      name: "dorada-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ interpreter: state.interpreter }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
