// File: components/layout/navbar.tsx
"use client";

import Link from "next/link";
import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/ui-store";
import { UserNav } from "./user-nav";

export function Navbar() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:pr-6 lg:pl-1 sticky top-0 z-30">
      {/* Toggle Sidebar Button (Mobile Only) */}
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>

      <div className="w-full flex-1">
        {/* Breadcrumbs หรือ Search Bar จะมาใส่ตรงนี้ */}
        <h1 className="text-lg font-semibold md:text-xl hidden md:block">
          Document Management System
        </h1>
      </div>

      {/* Right Actions (เหลือชุดเดียวที่ถูกต้อง) */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        
        {/* User Menu */}
        <UserNav />
      </div>
    </header>
  );
}