// File: app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import QueryProvider from '@/providers/query-provider';
import SessionProvider from '@/providers/session-provider'; // ✅ Import เข้ามา
import ThemeProvider from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { headers } from 'next/headers';
import { AiStatusBannerHost } from '@/components/ai/ai-status-banner-host';

export const metadata: Metadata = {
  title: 'LCBP3-DMS',
  description: 'Document Management System for Laem Chabang Port Phase 3',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const nonce = (await headers()).get('x-nonce') || '';

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <SessionProvider>
          <ThemeProvider nonce={nonce}>
            <QueryProvider>
              <AiStatusBannerHost />
              {children}
              <Toaster />
            </QueryProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
