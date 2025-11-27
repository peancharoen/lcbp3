// File: components/layout/dashboard-shell.tsx
"use client";

import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useUIStore();

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        // ปรับ Margin ซ้าย ตามสถานะ Sidebar
        isSidebarOpen ? "md:ml-[240px]" : "md:ml-[70px]"
      )}
    >
      {children}
    </div>
  );
}