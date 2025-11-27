// File: app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import QueryProvider from "@/providers/query-provider";
import SessionProvider from "@/providers/session-provider"; // ✅ Import เข้ามา

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LCBP3-DMS",
  description: "Document Management System for Laem Chabang Port Phase 3",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className
        )}
      >
        <SessionProvider> {/* ✅ หุ้มด้วย SessionProvider เป็นชั้นนอกสุด หรือใน body */}
          <QueryProvider>
            {children}
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}