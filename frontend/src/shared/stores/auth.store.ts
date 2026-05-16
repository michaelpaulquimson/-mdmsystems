import type { AuthUser } from '@mdm/shared';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUserWithPermissions extends AuthUser {
  permissions?: string[];
}

interface AuthState {
  user: AuthUserWithPermissions | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUserWithPermissions, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),

      setAccessToken: (token) => set({ accessToken: token }),

      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'mdm-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist refreshToken to localStorage; accessToken and user live in memory only
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);
