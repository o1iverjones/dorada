import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  organization_id: string;
}

interface AuthState {
  user: AdminUser | null;
  mfaToken: string | null;
  setUser: (user: AdminUser | null) => void;
  setMfaToken: (token: string | null) => void;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      mfaToken: null,
      setUser: (user) => set({ user }),
      setMfaToken: (mfaToken) => set({ mfaToken }),
      hasPermission: (permission) =>
        get().user?.permissions.includes(permission) ?? false,
      logout: () => set({ user: null, mfaToken: null }),
    }),
    {
      name: "dorada_auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
