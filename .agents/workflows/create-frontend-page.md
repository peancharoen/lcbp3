---
description: Create a new Next.js App Router page following project standards
---

# Create Next.js Frontend Page

Use this workflow when creating a new page in `frontend/app/`.
Follows `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`, ADR-011, ADR-012, ADR-013, ADR-014.

## Steps

1. **Determine route** — decide the route path, e.g. `app/(dashboard)/documents/page.tsx`

2. **Classify components** — decide what is Server Component (default) vs Client Component (`'use client'`)
   - Server Component: initial data load, static content, SEO
   - Client Component: interactivity, forms, TanStack Query hooks, Zustand

3. **Create page file** — Server Component by default:

```typescript
// app/(dashboard)/<route>/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '<Page Title> | LCBP3-DMS',
};

export default async function <PageName>Page() {
  return (
    <div>
      {/* Page content */}
    </div>
  );
}
```

4. **Create API hook** (if client-side data needed) — add to `hooks/use-<feature>.ts`:

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function use<Feature>() {
  return useQuery({
    queryKey: ['<feature>'],
    queryFn: () => apiClient.get('<endpoint>'),
  });
}
```

5. **Build UI components** — use Shadcn/UI primitives. Place reusable components in `components/<feature>/`.

6. **Handle forms** — use React Hook Form + Zod schema validation. Never access form values without validation.

7. **Handle errors** — add `error.tsx` alongside `page.tsx` for route-level error boundaries.

8. **Add loading state** — add `loading.tsx` for Suspense fallback if page does async work.

9. **Add to navigation** — update sidebar/nav config if the page should appear in the menu.

10. **Access control** — ensure page checks CASL permissions. Redirect unauthorized users via middleware or `notFound()`.

11. **Citation** — confirm implementation references `specs/01-Requirements/` and `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`
