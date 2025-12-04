"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Building2, Settings, FileText, Activity, Network, Hash } from "lucide-react";

const menuItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/workflows", label: "Workflows", icon: Network },
  { href: "/admin/numbering", label: "Numbering", icon: Hash },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/20 p-4 hidden md:block h-full">
      <h2 className="text-lg font-bold mb-6 px-3">Admin Panel</h2>
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
