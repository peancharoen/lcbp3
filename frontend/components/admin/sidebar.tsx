'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Settings, Activity, Shield, FileStack, ChevronDown, ChevronRight } from 'lucide-react';

interface MenuItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
}

export const menuItems: MenuItem[] = [
  {
    label: 'Access Control',
    icon: Shield,
    children: [
      { href: '/admin/access-control/users', label: 'Users' },
      { href: '/admin/access-control/roles', label: 'Roles' },
      { href: '/admin/access-control/organizations', label: 'Organizations' },
    ],
  },
  {
    label: 'Document Control',
    icon: FileStack,
    children: [
      { href: '/admin/doc-control/projects', label: 'Projects' },
      { href: '/admin/doc-control/contracts', label: 'Contracts' },
      { href: '/admin/doc-control/numbering', label: 'Numbering' },
      { href: '/admin/doc-control/reference', label: 'Reference Data' },
      { href: '/admin/doc-control/workflows', label: 'Workflows' },
    ],
  },
  {
    label: 'Drawing Master',
    icon: FileStack, // Or another icon
    children: [
      { href: '/admin/doc-control/drawings/contract/volumes', label: 'Contract: Volumes' },
      { href: '/admin/doc-control/drawings/contract/categories', label: 'Contract: Categories' },
      { href: '/admin/doc-control/drawings/contract/sub-categories', label: 'Contract: Sub-categories' },
      { href: '/admin/doc-control/drawings/shop/main-categories', label: 'Shop: Main Categories' },
      { href: '/admin/doc-control/drawings/shop/sub-categories', label: 'Shop: Sub-categories' },
    ],
  },
  {
    label: 'Monitoring',
    icon: Activity,
    children: [
      { href: '/admin/monitoring/audit-logs', label: 'Audit Logs' },
      { href: '/admin/monitoring/system-logs/numbering', label: 'System Logs' },
      { href: '/admin/monitoring/sessions', label: 'Active Sessions' },
    ],
  },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(
    // Auto-expand if current path matches a child
    menuItems
      .filter((item) => item.children?.some((child) => pathname.startsWith(child.href)))
      .map((item) => item.label)
  );

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
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
            const hasActiveChild = item.children.some((child) => pathname.startsWith(child.href));

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                    hasActiveChild
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </span>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                            'block px-3 py-1.5 rounded-lg transition-colors text-sm',
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export function AdminMobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(
    menuItems
      .filter((item) => item.children?.some((child) => pathname.startsWith(child.href)))
      .map((item) => item.label)
  );

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle admin menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
        <div className="h-16 flex items-center px-4 border-b">
          <span className="text-lg font-bold tracking-tight">Admin Console</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 h-[calc(100vh-4rem)]">
          <nav className="space-y-1 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon;

              if (item.children) {
                const isExpanded = expandedMenus.includes(item.label);
                const hasActiveChild = item.children.some((child) => pathname.startsWith(child.href));

                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                        hasActiveChild
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                        {item.children.map((child) => {
                          const isActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                'block px-3 py-1.5 rounded-lg transition-colors text-sm',
                                isActive
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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

              const isActive = pathname.startsWith(item.href!);
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 mt-8 border-t absolute bottom-0 w-full left-0 bg-background">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
