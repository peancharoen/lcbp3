"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Building2, Settings, FileText, Activity, GitGraph, Shield, BookOpen } from "lucide-react";

const menuItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FileText },
  { href: "/admin/reference", label: "Reference Data", icon: BookOpen },
  { href: "/admin/numbering", label: "Numbering", icon: FileText },
  { href: "/admin/workflows", label: "Workflows", icon: GitGraph },
  { href: "/admin/security/roles", label: "Security Roles", icon: Shield },
  { href: "/admin/security/sessions", label: "Active Sessions", icon: Users },
  { href: "/admin/system-logs/numbering", label: "System Logs", icon: Activity },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card p-4 hidden md:block">
      <div className="mb-8 px-2">
         <h2 className="text-xl font-bold tracking-tight">Admin Console</h2>
         <p className="text-sm text-muted-foreground">LCBP3 DMS</p>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 px-2 fixed bottom-4 w-56">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
              ← Back to Dashboard
          </Link>
      </div>
    </aside>
  );
}
