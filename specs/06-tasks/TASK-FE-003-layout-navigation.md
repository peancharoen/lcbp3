# TASK-FE-003: Layout & Navigation System

**ID:** TASK-FE-003
**Title:** Dashboard Layout, Sidebar & Navigation
**Category:** Foundation
**Priority:** P0 (Critical)
**Effort:** 3-4 days
**Dependencies:** TASK-FE-001, TASK-FE-002
**Assigned To:** Frontend Developer

---

## 📋 Overview

Create responsive dashboard layout with sidebar navigation, header, and optimized nested layouts using Next.js App Router.

---

## 🎯 Objectives

1. Create responsive dashboard layout
2. Implement sidebar with navigation menu
3. Create header with user menu and breadcrumbs
4. Setup route groups for layout organization
5. Implement mobile-responsive design
6. Add dark mode support (optional)

---

## ✅ Acceptance Criteria

- [ ] Dashboard layout responsive (desktop/tablet/mobile)
- [ ] Sidebar collapsible on mobile
- [ ] Navigation highlights active route
- [ ] Breadcrumbs show current location
- [ ] User menu functional
- [ ] Layout persists across page navigation

---

## 🔧 Implementation Steps

### Step 1: Dashboard Layout

```typescript
// File: src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const cookieStore = cookies();
  const token = cookieStore.get('auth-token');

  if (!token) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Step 2: Sidebar Component

```typescript
// File: src/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FileText,
  Clipboard,
  Image,
  Send,
  Users,
  Settings,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/stores/ui-store';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/correspondences', label: 'Correspondences', icon: FileText },
  { href: '/rfas', label: 'RFAs', icon: Clipboard },
  { href: '/drawings', label: 'Drawings', icon: Image },
  { href: '/transmittals', label: 'Transmittals', icon: Send },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-white transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!sidebarCollapsed && <h1 className="text-lg font-bold">LCBP3-DMS</h1>}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="ml-auto"
        >
          <MenuIcon />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!sidebarCollapsed && (
        <div className="border-t p-4 text-xs text-gray-500">Version 1.5.0</div>
      )}
    </aside>
  );
}
```

### Step 3: Header Component

```typescript
// File: src/components/layout/header.tsx
'use client';

import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <Breadcrumbs />

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
```

### Step 4: Breadcrumbs Component

```typescript
// File: src/components/layout/breadcrumbs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center space-x-2 text-sm">
      <Link href="/" className="text-gray-600 hover:text-gray-900">
        Home
      </Link>

      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const label = segment.charAt(0).toUpperCase() + segment.slice(1);
        const isLast = index === segments.length - 1;

        return (
          <div key={href} className="flex items-center space-x-2">
            <ChevronRight className="h-4 w-4 text-gray-400" />
            {isLast ? (
              <span className="font-medium text-gray-900">{label}</span>
            ) : (
              <Link href={href} className="text-gray-600 hover:text-gray-900">
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
```

### Step 5: UI Store (Sidebar State)

```typescript
// File: src/lib/stores/ui-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'ui-preferences',
    }
  )
);
```

### Step 6: Mobile Responsive

```typescript
// File: src/components/layout/mobile-sidebar.tsx
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
```

---

## 🧪 Testing & Verification

### Manual Testing

1. **Desktop Layout**

   - Sidebar visible and functional
   - Toggle sidebar collapse/expand
   - Active route highlighted

2. **Mobile Layout**

   - Sidebar hidden by default
   - Hamburger menu opens sidebar
   - Sidebar slides from left

3. **Navigation**

   - Click menu items → Navigate correctly
   - Breadcrumbs update on navigation
   - Active state persists on reload

4. **User Menu**
   - Display user info
   - Logout functional

---

## 📦 Deliverables

- [ ] Dashboard layout for (dashboard) route group
- [ ] Responsive sidebar with navigation
- [ ] Header with breadcrumbs and user menu
- [ ] UI store for sidebar state
- [ ] Mobile-responsive design
- [ ] Icon library (lucide-react)

---

## 🔗 Related Documents

- [ADR-011: Next.js App Router](../../05-decisions/ADR-011-nextjs-app-router.md)
- [ADR-014: State Management](../../05-decisions/ADR-014-state-management.md)
- [TASK-FE-002: Auth UI](./TASK-FE-002-auth-ui.md)

---

**Created:** 2025-12-01
**Status:** Ready
