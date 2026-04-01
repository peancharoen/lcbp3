// File: providers/session-provider.tsx
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { AuthSync } from '@/components/auth/auth-sync';

export default function SessionProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <NextAuthSessionProvider nonce={nonce}>
      <AuthSync />
      {children}
    </NextAuthSessionProvider>
  );
}
