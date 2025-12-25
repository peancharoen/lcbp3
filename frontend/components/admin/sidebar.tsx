"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Users,
  Building2,
  Settings,
  FileText,
  Activity,
  GitGraph,
  Shield,
  BookOpen,
  FileStack,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface MenuItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
}

const menuItems: MenuItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FileText },
  { href: "/admin/contracts", label: "Contracts", icon: FileText },
  { href: "/admin/reference", label: "Reference Data", icon: BookOpen },
  {
    label: "Drawing Master Data",
    icon: FileStack,
    children: [
      { href: "/admin/drawings/contract/volumes", label: "Contract: Volumes" },
      { href: "/admin/drawings/contract/categories", label: "Contract: Categories" },
      { href: "/admin/drawings/contract/sub-categories", label: "Contract: Sub-categories" },
      { href: "/admin/drawings/shop/main-categories", label: "Shop: Main Categories" },
      { href: "/admin/drawings/shop/sub-categories", label: "Shop: Sub-categories" },
    ]
  },
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
  const [expandedMenus, setExpandedMenus] = useState<string[]>(
    // Auto-expand if current path matches a child
    menuItems
      .filter(item => item.children?.some(child => pathname.startsWith(child.href)))
      .map(item => item.label)
  );

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  return (
    <aside className="w-64 border-r bg-card p-4 hidden md:block">
      <div className="mb-8 px-2">
         <h2 className="text-xl font-bold tracking-tight">Admin Console</h2>
         <p className="text-sm text-muted-foreground">LCBP3 DMS</p>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;

          // Has children - collapsible menu
          if (item.children) {
            const isExpanded = expandedMenus.includes(item.label);
            const hasActiveChild = item.children.some(child => pathname.startsWith(child.href));

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                    hasActiveChild
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "block px-3 py-1.5 rounded-lg transition-colors text-sm",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Simple menu item
          const isActive = pathname.startsWith(item.href!);
          return (
            <Link
              key={item.href}
              href={item.href!}
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
