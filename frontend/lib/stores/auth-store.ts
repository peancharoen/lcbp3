// File: lib/stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string | 'User' | 'Admin' | 'Viewer';
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string) => void;
  logout: () => void;

  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      hasPermission: (requiredPermission: string) => {
        const { user } = get();
        if (!user) return false;

        if (user.permissions?.includes(requiredPermission)) return true;
        if (['Admin', 'ADMIN', 'admin'].includes(user.role)) return true;

        return false;
      },

      hasRole: (requiredRole: string) => {
        const { user } = get();
        return user?.role === requiredRole;
      }
    }),
    {
      name: 'auth-storage',
    }
  )
);
