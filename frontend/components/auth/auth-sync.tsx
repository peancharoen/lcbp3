'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';

export function AuthSync() {
  const { data: session, status } = useSession();
  const { setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      signOut({ callbackUrl: '/login' });
    } else if (status === 'authenticated' && session?.user) {
      // Map NextAuth session to AuthStore user
      // Assuming session.user has the fields we need based on types/next-auth.d.ts

      // Map NextAuth session user to AuthStore user type
      const user = session.user as {
        id?: string;
        user_id?: string;
        username?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
        permissions?: string[];
      };

      setAuth(
        {
          id: user.id || user.user_id || '',
          username: user.username || '',
          email: user.email || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          role: user.role || 'User',
          permissions: user.permissions,
        },
        (session as { accessToken?: string }).accessToken || ''
      );
    } else if (status === 'unauthenticated') {
      logout();
    }
  }, [session, status, setAuth, logout]);

  return null; // This component renders nothing
}
