// File: components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { sidebarMenuItems, adminMenuItems } from "@/config/menu";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Menu, X } from "lucide-react";
import { useEffect } from "react"; // ✅ Import useEffect

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar, closeSidebar } = useUIStore();

  // ✅ เพิ่ม Logic นี้: ปิด Sidebar อัตโนมัติเมื่อหน้าจอเล็กกว่า 768px (Mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isSidebarOpen) {
        closeSidebar();
      }
    };

    // ติดตั้ง Listener
    window.addEventListener("resize", handleResize);

    // ล้าง Listener เมื่อ Component ถูกทำลาย
    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarOpen, closeSidebar]);

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-all duration-100 md:hidden",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeSidebar}
      />

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen border-r bg-card transition-all duration-300 ease-in-out flex flex-col",
          
          // Mobile Width
          "w-[240px]",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",

          // Desktop Styles
          "md:translate-x-0",
          isSidebarOpen ? "md:w-[240px]" : "md:w-[70px]"
        )}
      >
        <div className={cn(
          "flex h-14 items-center border-b px-3 lg:h-[60px]",
          "justify-between md:justify-center",
          isSidebarOpen && "md:justify-between"
        )}>
          
          <div className={cn(
            "flex items-center gap-2 font-bold text-primary truncate transition-all duration-300",
            !isSidebarOpen && "md:w-0 md:opacity-0 md:hidden"
          )}>
            <Link href="/dashboard">LCBP3 DMS</Link>
          </div>

          {/* Desktop Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden md:flex h-8 w-8"
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar} // ปุ่มนี้จะทำงานได้ถูกต้อง
            className="md:hidden h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          <nav className="grid gap-1 px-2">
            {sidebarMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    !isSidebarOpen && "md:justify-center md:px-2"
                  )}
                  title={!isSidebarOpen ? item.title : undefined}
                  onClick={() => {
                    if (window.innerWidth < 768) closeSidebar();
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn(
                    "truncate transition-all duration-300",
                    !isSidebarOpen && "md:w-0 md:opacity-0 md:hidden"
                  )}>
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}