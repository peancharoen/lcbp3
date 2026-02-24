# ADR-011: Next.js App Router & Routing Strategy

**Status:** ✅ Accepted
**Date:** 2025-12-01
**Decision Makers:** Frontend Team, System Architect
**Related Documents:** [Frontend Guidelines](../05-Engineering-Guidelines/05-03-frontend-guidelines.md), [ADR-005: Technology Stack](./ADR-005-technology-stack.md)

---

## Context and Problem Statement

Next.js มี 2 รูปแบบ Router หลัก: Pages Router (เก่า) และ App Router (ใหม่ใน Next.js 13+) ต้องเลือกว่าจะใช้แบบไหนสำหรับ LCBP3-DMS

### ปัญหาที่ต้องแก้:

1. **Routing Architecture:** ใช้ Pages Router หรือ App Router
2. **Server vs Client Components:** จัดการ Data Fetching อย่างไร
3. **Layout System:** จัดการ Shared Layouts อย่างไร
4. **Performance:** ทำอย่างไรให้ Initial Load เร็ว
5. **SEO:** ต้องการ SEO หรือไม่ (Dashboard ไม่ต้องการ)

---

## Decision Drivers

- 🚀 **Performance:** Initial load time และ Navigation speed
- 🎯 **Developer Experience:** ง่ายต่อการพัฒนาและบำรุงรักษา
- 📦 **Code Organization:** โครงสร้างโค้ดชัดเจน
- 🔄 **Future-Proof:** พร้อมสำหรับ Next.js รุ่นถัดไป
- 🎨 **Layout Flexibility:** จัดการ Nested Layouts ได้ง่าย

---

## Considered Options

### Option 1: Pages Router (Traditional)

**โครงสร้าง:**

```
pages/
  ├── _app.tsx
  ├── _document.tsx
  ├── index.tsx
  ├── correspondences/
  │   ├── index.tsx
  │   └── [id].tsx
  └── api/
      └── ...
```

**Pros:**

- ✅ Mature และ Stable
- ✅ Documentation ครบถ้วน
- ✅ Community ใหญ่
- ✅ ทีมคุ้นเคยแล้ว

**Cons:**

- ❌ ไม่รองรับ Server Components
- ❌ Layout System ซับซ้อน (ต้องใช้ HOC)
- ❌ Data Fetching ไม่ทันสมัย
- ❌ Not recommended for new projects

### Option 2: App Router (New - Recommended)

**โครงสร้าง:**

```
app/
  ├── layout.tsx           # Root layout
  ├── page.tsx             # Home page
  ├── correspondences/
  │   ├── layout.tsx       # Nested layout
  │   ├── page.tsx         # List page
  │   └── [id]/
  │       └── page.tsx     # Detail page
  └── (auth)/
      ├── layout.tsx
      └── login/
          └── page.tsx
```

**Pros:**

- ✅ Server Components (Better performance)
- ✅ Built-in Layout System
- ✅ Streaming & Suspense support
- ✅ Better Data Fetching patterns
- ✅ Recommended by Next.js team

**Cons:**

- ❌ Newer (less community resources)
- ❌ Learning curve สำหรับทีม
- ❌ Some libraries ยังไม่รองรับ

### Option 3: Hybrid Approach

ใช้ App Router + Pages Router พร้อมกัน

**Pros:**

- ✅ Gradual migration

**Cons:**

- ❌ เพิ่มความซับซ้อน
- ❌ Confusing สำหรับทีม

---

## Decision Outcome

**Chosen Option:** **Option 2 - App Router**

### Rationale

1. **Future-Proof:** Next.js แนะนำให้ใช้ App Router สำหรับโปรเจกต์ใหม่
2. **Performance:** Server Components ช่วยลด JavaScript bundle size
3. **Better DX:** Layout System สะดวกกว่า
4. **Server Actions:** รองรับ Form submissions โดยไม่ต้องสร้าง API routes
5. **Learning Investment:** Team จะได้ Skill ที่ทันสมัย

---

## Implementation Details

### 1. Folder Structure

```
app/
  ├── (public)/              # Public routes (no auth)
  │   ├── layout.tsx
  │   └── login/
  │       └── page.tsx
  │
  ├── (dashboard)/           # Protected routes
  │   ├── layout.tsx         # Dashboard layout with sidebar
  │   ├── page.tsx           # Dashboard home
  │   │
  │   ├── correspondences/
  │   │   ├── layout.tsx
  │   │   ├── page.tsx       # List
  │   │   ├── new/
  │   │   │   └── page.tsx   # Create
  │   │   └── [id]/
  │   │       ├── page.tsx   # Detail
  │   │       └── edit/
  │   │           └── page.tsx
  │   │
  │   ├── rfas/
  │   ├── drawings/
  │   └── settings/
  │
  ├── api/                   # API route handlers (minimal)
  │   └── auth/
  │       └── [...nextauth]/
  │           └── route.ts
  │
  ├── layout.tsx             # Root layout
  └── page.tsx               # Root redirect
```

### 2. Root Layout

```typescript
// File: app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LCBP3-DMS',
  description: 'Document Management System for Laem Chabang Port Phase 3',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### 3. Dashboard Layout (with Sidebar)

```typescript
// File: app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 4. Server Component (Data Fetching)

```typescript
// File: app/(dashboard)/correspondences/page.tsx
import { CorrespondenceList } from '@/components/correspondences/list';
import { getCorrespondences } from '@/lib/api/correspondences';

export default async function CorrespondencesPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  // Fetch data on server
  const correspondences = await getCorrespondences({
    page: parseInt(searchParams.page || '1'),
    status: searchParams.status,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Correspondences</h1>
      <CorrespondenceList data={correspondences} />
    </div>
  );
}
```

### 5. Client Component (Interactive)

```typescript
// File: components/correspondences/list.tsx
'use client'; // Client Component

import { useState } from 'react';
import { Correspondence } from '@/types';

export function CorrespondenceList({ data }: { data: Correspondence[] }) {
  const [filter, setFilter] = useState('');

  const filtered = data.filter((item) =>
    item.subject.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border p-2 mb-4"
      />
      <div>
        {filtered.map((item) => (
          <div key={item.id}>{item.subject}</div>
        ))}
      </div>
    </div>
  );
}
```

### 6. Loading States

```typescript
// File: app/(dashboard)/correspondences/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded animate-pulse" />
      <div className="h-64 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
```

### 7. Error Handling

```typescript
// File: app/(dashboard)/correspondences/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-red-600">Something went wrong!</h2>
      <p className="text-gray-600">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
}
```

---

## Routing Patterns

### Route Groups (Organization)

```
(public)/     # Public pages
(dashboard)/  # Protected dashboard
(auth)/       # Auth-related pages
```

### Dynamic Routes

```
[id]/         # Dynamic segment (e.g., /correspondences/123)
[...slug]/    # Catch-all (e.g., /docs/a/b/c)
```

### Parallel Routes & Intercepting Routes

```
@modal/       # Parallel route for modals
(.)/          # Intercept same level
```

---

## Consequences

### Positive Consequences

1. ✅ **Better Performance:** Server Components ลด Client JavaScript
2. ✅ **SEO-Friendly:** Server-side rendering out of the box
3. ✅ **Simpler Layouts:** Nested layouts ทำได้ง่าย
4. ✅ **Streaming:** Progressive rendering with Suspense
5. ✅ **Future-Proof:** ทิศทางของ Next.js และ React

### Negative Consequences

1. ❌ **Learning Curve:** ทีมต้องเรียนรู้ Server Components
2. ❌ **Limited Libraries:** บาง Libraries ยังไม่รองรับ Server Components
3. ❌ **Debugging:** ยากกว่า Pages Router เล็กน้อย

### Mitigation Strategies

- **Training:** จัด Workshop เรื่อง App Router และ Server Components
- **Documentation:** เขียน Internal docs สำหรับ Patterns ที่ใช้
- **Code Review:** Review code ให้ใช้ Server/Client Components ถูกต้อง
- **Gradual Adoption:** เริ่มจาก Simple pages ก่อน

---

## Related ADRs

- [ADR-005: Technology Stack](./ADR-005-technology-stack.md) - เลือกใช้ Next.js
- [ADR-012: UI Component Library](./ADR-012-ui-component-library.md) - Shadcn/UI

---

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [React Server Components](https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components)

---

**Last Updated:** 2025-12-01
**Next Review:** 2026-06-01
