'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  PenTool,
  Search,
  Settings,
  Shield,
  Menu,
  Layers,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Can } from '@/components/common/can';
import { useAuthStore } from '@/lib/stores/auth-store';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string | null;
  adminOnly?: boolean;
};

export const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: null, // Everyone can see
  },
  {
    title: 'Correspondences',
    href: '/correspondences',
    icon: FileText,
    permission: null,
  },
  {
    title: 'RFAs',
    href: '/rfas',
    icon: FileCheck,
    permission: null,
  },
  {
    title: 'Drawings',
    href: '/drawings',
    icon: PenTool,
    permission: null,
  },
  {
    title: 'Circulations',
    href: '/circulation',
    icon: Layers, // Start with generic icon, maybe update import if needed
    permission: null,
  },
  {
    title: 'Transmittals',
    href: '/transmittals',
    icon: FileText,
    permission: null,
  },
  {
    title: 'Search',
    href: '/search',
    icon: Search,
    permission: null,
  },
  {
    title: 'Admin Panel',
    href: '/admin',
    icon: Shield,
    permission: null,
    adminOnly: true,
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DC';

  return (
    <div
      className={cn(
        'hidden md:flex flex-col h-screen border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b">
        {!collapsed && <span className="text-lg font-bold text-primary truncate">LCBP3 DMS</span>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('ml-auto', collapsed && 'mx-auto')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {mainNavItems.map((item, index) => {
            if (item.adminOnly && !isAdmin) return null;

            const isActive = pathname.startsWith(item.href);

            const LinkComponent = (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.title : undefined}
              >
                <item.icon className="h-5 w-5" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );

            if (item.permission) {
              return (
                <Can key={index} permission={item.permission}>
                  {LinkComponent}
                </Can>
              );
            }

            return LinkComponent;
          })}
        </nav>
      </div>

      <div className="p-4 border-t">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            collapsed && 'justify-center px-2'
          )}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );
}

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

export function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DC';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
        <div className="h-16 flex items-center px-4 border-b">
          <span className="text-lg font-bold text-primary truncate">LCBP3 DMS</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4 h-[calc(100vh-4rem)]">
          <nav className="grid gap-1 px-2">
            {mainNavItems.map((item, index) => {
              if (item.adminOnly && !isAdmin) return null;

              const isActive = pathname.startsWith(item.href);

              const LinkComponent = (
                <Link
                  key={index}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              );

              if (item.permission) {
                return (
                  <Can key={index} permission={item.permission}>
                    {LinkComponent}
                  </Can>
                );
              }

              return LinkComponent;
            })}
          </nav>

          <div className="p-4 mt-auto border-t absolute bottom-0 w-full left-0 bg-background">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
