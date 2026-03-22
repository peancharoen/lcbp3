# ADR-014: State Management Strategy

**Status:** ✅ Accepted
**Date:** 2026-02-24
**Decision Makers:** Frontend Team
**Related Documents:** [Frontend Guidelines](../05-Engineering-Guidelines/05-03-frontend-guidelines.md), [ADR-011: App Router](./ADR-011-nextjs-app-router.md)

---

## Context and Problem Statement

ระบบ LCBP3-DMS ต้องการจัดการ Global State เช่น User session, Notifications, UI preferences ต้องเลือก State Management solution ที่เหมาะสม

### ปัญหาที่ต้องแก้:

1. **Global State:** จัดการ State ที่ใช้ร่วมกันทั้งแอปอย่างไร
2. **Server State:** จัดการข้อมูลจาก API อย่างไร
3. **Performance:** หลีกเลี่ยง Unnecessary re-renders
4. **Type Safety:** Type-safe state management
5. **Bundle Size:** ไม่ทำให้ Bundle ใหญ่เกินไป

---

## Decision Drivers

- ⚡ **Performance:** Minimal re-renders
- 📦 **Bundle Size:** เล็กที่สุด
- 🎯 **Simplicity:** เรียนรู้และใช้งานง่าย
- ✅ **Type Safety:** TypeScript support
- 🔄 **Server State:** จัดการ API data ได้ดี

---

## Considered Options

### Option 1: Redux Toolkit

**Pros:**

- ✅ Industry standard
- ✅ DevTools ดี
- ✅ Middleware support

**Cons:**

- ❌ Boilerplate มาก
- ❌ Bundle size ใหญ่ (~40kb)
- ❌ Complexity สูง
- ❌ Overkill สำหรับ App ส่วนใหญ่

### Option 2: React Context API

**Pros:**

- ✅ Built-in (no dependencies)
- ✅ Simple

**Cons:**

- ❌ Performance issues (re-render ทั้ง tree)
- ❌ ไม่เหมาะสำหรับ Complex state
- ❌ ต้องจัดการ Optimization เอง

### Option 3: Zustand

**Props:**

- ✅ **Lightweight:** ~1.2kb only
- ✅ **Simple API:** เรียนรู้ง่าย
- ✅ **Performance:** Selective re-renders
- ✅ **TypeScript:** Full support
- ✅ **No boilerplate**
- ✅ **DevTools support**

**Cons:**

- ❌ Smaller community กว่า Redux

### Option 4: React Query (TanStack Query) for Server State

**Pros:**

- ✅ **Specialized:** จัดการ Server state ได้ดีที่สุด
- ✅ **Caching:** Auto cache management
- ✅ **Refetching:** Auto refetch on focus
- ✅ **TypeScript:** Excellent support

**Cons:**

- ❌ เฉพาะ Server state (ต้องใช้คู่กับ Client state solution)

---

## Decision Outcome

**Chosen Option:** **Zustand (Client State) + TanStack Query (Server State) + React Hook Form + Zod (Form State)**

### Rationale

**For Client State (UI state, Preferences):**

- Use **Zustand** - lightweight และเรียนรู้ง่าย

**For Server State (API data):**

- Use **TanStack Query** (React Query) สำหรับ data fetching, caching, synchronization
- Server Components สำหรับ initial data loading

**For Form State:**

- Use **React Hook Form + Zod** สำหรับ type-safe form management

---

## Implementation Details

### 1. Install Zustand

```bash
npm install zustand
```

### 2. Create Global Store (User Session)

```typescript
// File: lib/stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage', // LocalStorage key
    }
  )
);
```

### 3. Use Store in Components

```typescript
// File: components/header.tsx
'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="flex justify-between items-center p-4">
      <div>Welcome, {user?.first_name}</div>
      <Button onClick={logout}>Logout</Button>
    </header>
  );
}
```

### 4. Notifications Store

```typescript
// File: lib/stores/notification-store.ts
import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NotificationState {
  notifications: Notification[];

  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id: Math.random().toString() }],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));
```

### 5. Server State with Server Components

```typescript
// File: app/(dashboard)/correspondences/page.tsx
// Server Component - No state management needed!

import { getCorrespondences } from '@/lib/api/correspondences';

export default async function CorrespondencesPage() {
  // Fetch directly on server
  const correspondences = await getCorrespondences();

  return (
    <div>
      <h1>Correspondences</h1>
      {correspondences.map((item) => (
        <div key={item.id}>{item.subject}</div>
      ))}
    </div>
  );
}
```

### 6. Client-Side Fetching (with TanStack Query)

```bash
npm install @tanstack/react-query
```

```typescript
// File: components/correspondences/correspondence-list.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { getCorrespondences } from '@/lib/api/correspondences';

export function CorrespondenceList() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['correspondences'],
    queryFn: getCorrespondences,
    refetchInterval: 30000, // Auto refresh every 30s
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      {data?.map((item) => (
        <div key={item.id}>{item.subject}</div>
      ))}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### 7. UI Preferences Store

```typescript
// File: lib/stores/ui-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';

  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'light',

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-preferences',
    }
  )
);
```

---

## State Management Patterns

### When to Use Zustand (Client State)

✅ Use Zustand for:

- User authentication state
- UI preferences (theme, sidebar state)
- Notifications/Toasts
- Shopping cart (if applicable)
- Form wizard state
- Modal state (global)

### When to Use Server Components (Server State)

✅ Use Server Components for:

- Initial data loading
- Static/semi-static data
- SEO-important content
- Data that doesn't need real-time updates

### When to Use TanStack Query (Client-Side Server State)

✅ Use TanStack Query for:

- Real-time data (notifications count)
- Polling/Auto-refresh data
- User-specific data that changes often
- Optimistic UI updates
- Complex cache invalidation
- Paginated/infinite scroll data

---

## Consequences

### Positive Consequences

1. ✅ **Lightweight:** Zustand ~1.2kb
2. ✅ **Simple:** Easy to learn and use
3. ✅ **Performance:** Selective re-renders
4. ✅ **No Boilerplate:** Clean API
5. ✅ **Type Safe:** Full TypeScript support
6. ✅ **Persistent:** Easy LocalStorage persist

### Negative Consequences

1. ❌ **Smaller Ecosystem:** กว่า Redux
2. ❌ **Less Tooling:** DevTools ไม่ครบเท่า Redux

### Mitigation Strategies

- **Documentation:** Document common patterns
- **Code Examples:** Provide store templates
- **Testing:** Unit test stores thoroughly

---

## Related ADRs

- [ADR-011: Next.js App Router](./ADR-011-nextjs-app-router.md) - Server Components
- [ADR-007: API Design](./ADR-007-api-design-error-handling.md)

---

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Hook Form Documentation](https://react-hook-form.com/)

---

**Last Updated:** 2026-02-24
**Next Review:** 2026-06-01
