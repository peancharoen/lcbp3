---
name: next-best-practices
description: Next.js best practices for LCBP3-DMS frontend. Enforces ADR-019 (publicId only, no parseInt/id fallback), TanStack Query + RHF + Zod, shadcn/ui, i18n, ADR-007 error UX, ADR-021 IntegratedBanner/WorkflowLifecycle, two-phase file upload.
version: 1.9.0
scope: frontend
user-invocable: false
---

# Next.js Best Practices

Apply these rules when writing or reviewing Next.js code.

## File Conventions

See [file-conventions.md](./file-conventions.md) for:

- Project structure and special files
- Route segments (dynamic, catch-all, groups)
- Parallel and intercepting routes
- Middleware rename in v16 (middleware → proxy)

## RSC Boundaries

Detect invalid React Server Component patterns.

See [rsc-boundaries.md](./rsc-boundaries.md) for:

- Async client component detection (invalid)
- Non-serializable props detection
- Server Action exceptions

## Async Patterns

Next.js 15+ async API changes.

See [async-patterns.md](./async-patterns.md) for:

- Async `params` and `searchParams`
- Async `cookies()` and `headers()`
- Migration codemod

## Runtime Selection

See [runtime-selection.md](./runtime-selection.md) for:

- Default to Node.js runtime
- When Edge runtime is appropriate

## Directives

See [directives.md](./directives.md) for:

- `'use client'`, `'use server'` (React)
- `'use cache'` (Next.js)

## Functions

See [functions.md](./functions.md) for:

- Navigation hooks: `useRouter`, `usePathname`, `useSearchParams`, `useParams`
- Server functions: `cookies`, `headers`, `draftMode`, `after`
- Generate functions: `generateStaticParams`, `generateMetadata`

## Error Handling

See [error-handling.md](./error-handling.md) for:

- `error.tsx`, `global-error.tsx`, `not-found.tsx`
- `redirect`, `permanentRedirect`, `notFound`
- `forbidden`, `unauthorized` (auth errors)
- `unstable_rethrow` for catch blocks

## Data Patterns

Project-specific: See [uuid-handling.md](./uuid-handling.md) for ADR-019 UUID handling patterns.

See [data-patterns.md](./data-patterns.md) for:

- Server Components vs Server Actions vs Route Handlers
- Avoiding data waterfalls (`Promise.all`, Suspense, preload)
- Client component data fetching

## Route Handlers

See [route-handlers.md](./route-handlers.md) for:

- `route.ts` basics
- GET handler conflicts with `page.tsx`
- Environment behavior (no React DOM)
- When to use vs Server Actions

## Metadata & OG Images

See [metadata.md](./metadata.md) for:

- Static and dynamic metadata
- `generateMetadata` function
- OG image generation with `next/og`
- File-based metadata conventions

## Image Optimization

See [image.md](./image.md) for:

- Always use `next/image` over `<img>`
- Remote images configuration
- Responsive `sizes` attribute
- Blur placeholders
- Priority loading for LCP

## Font Optimization

See [font.md](./font.md) for:

- `next/font` setup
- Google Fonts, local fonts
- Tailwind CSS integration
- Preloading subsets

## Bundling

See [bundling.md](./bundling.md) for:

- Server-incompatible packages
- CSS imports (not link tags)
- Polyfills (already included)
- ESM/CommonJS issues
- Bundle analysis

## Scripts

See [scripts.md](./scripts.md) for:

- `next/script` vs native script tags
- Inline scripts need `id`
- Loading strategies
- Google Analytics with `@next/third-parties`

## Hydration Errors

See [hydration-error.md](./hydration-error.md) for:

- Common causes (browser APIs, dates, invalid HTML)
- Debugging with error overlay
- Fixes for each cause

## Suspense Boundaries

See [suspense-boundaries.md](./suspense-boundaries.md) for:

- CSR bailout with `useSearchParams` and `usePathname`
- Which hooks require Suspense boundaries

## Parallel & Intercepting Routes

See [parallel-routes.md](./parallel-routes.md) for:

- Modal patterns with `@slot` and `(.)` interceptors
- `default.tsx` for fallbacks
- Closing modals correctly with `router.back()`

## i18n (Thai / English)

See [i18n.md](./i18n.md) for:

- `useTranslations('namespace')` pattern
- Key naming (kebab-case, feature-namespaced)
- When Zod messages stay inline vs i18n
- Server-side `userMessage` passthrough

## Two-Phase File Upload

See [two-phase-upload.md](./two-phase-upload.md) for:

- `useDropzone` + `useMutation` hook
- `tempFileIds` form-state pattern
- Whitelist MIME / max-size (must mirror backend)
- Clear-on-submit / expired-temp handling

## Self-Hosting

See [self-hosting.md](./self-hosting.md) for:

- `output: 'standalone'` for Docker
- Cache handlers for multi-instance ISR
- What works vs needs extra setup

## NAP-DMS Project-Specific Rules (MUST FOLLOW)

These rules are mandatory for the NAP-DMS LCBP3 frontend project:

### State Management (บังคับใช้)

**Server State - TanStack Query (React Query)**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ❌ ห้ามใช้ useEffect โดยตรง
// ✅ ใช้ TanStack Query
export function useCorrespondences(projectId: string) {
  return useQuery({
    queryKey: ['correspondences', projectId],
    queryFn: () => correspondenceService.getAll(projectId),
    staleTime: 5 * 60 * 1000,
  });
}
```

**Form State - React Hook Form + Zod**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  title: z.string().min(1, 'กรุณาระบุหัวเรื่อง'),
  projectUuid: z.string().uuid('กรุณาเลือกโปรเจกต์'),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

### ADR-019 UUID Handling (CRITICAL — March 2026 Pattern)

> **Updated:** ใช้ `publicId` ตรงๆ — ห้ามใช้ `id ?? ''` fallback หรือ `uuid` ร่วม.

```tsx
// ✅ CORRECT — Interface มีแค่ publicId
interface Contract {
  publicId?: string; // UUID from API — ใช้ตัวนี้
  contractCode: string;
  contractName: string;
}

// ✅ CORRECT — Select options (ไม่มี fallback)
const options = contracts.map((c) => ({
  label: `${c.contractName} (${c.contractCode})`,
  value: c.publicId ?? '', // ใช้ publicId ล้วน
  key: c.publicId ?? c.contractCode, // fallback ไป business field ได้
}));

// ❌ WRONG — pattern เก่า (ห้าม)
interface OldContract {
  id?: number; // ❌ อย่า expose INT id
  uuid?: string; // ❌ ใช้ชื่อ uuid
  publicId?: string;
}
const oldValue = String(c.publicId ?? c.id ?? ''); // ❌ `id ?? ''` fallback ห้าม

// ❌ NEVER parseInt on UUID
// const badId = parseInt(projectPublicId); // "019505..." → 19 (WRONG!)

// ✅ ส่ง UUID string ตรงๆ ไป API
apiClient.get(`/projects/${projectPublicId}`);
```

### Naming Conventions

**Code Identifiers - ภาษาอังกฤษ**

```tsx
// ✅ Correct
interface Correspondence {
  documentNumber: string;
  createdAt: string;
}

// ❌ Wrong
interface เอกสาร {
  เลขที่: string;
}
```

**Comments - ภาษาไทย**

```tsx
// ✅ Correct - อธิบาย logic เป็นภาษาไทย
// ตรวจสอบว่ามีการระบุ projectUuid หรือไม่
if (!data.projectUuid) {
  throw new Error('กรุณาเลือกโปรเจกต์');
}

// ❌ Wrong - ห้ามใช้ภาษาอังกฤษใน comments
// Check if projectUuid is provided
```

### UI Components

**บังคับใช้ shadcn/ui**

```tsx
// ✅ Correct
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ❌ Wrong - ไม่สร้าง component เองถ้ามีใน shadcn
const MyButton = () => <button className="...">Click</button>;
```

### File Upload Pattern

```tsx
import { useDropzone } from 'react-dropzone';

// Two-phase upload
const onDrop = useCallback(async (files: File[]) => {
  // Phase 1: Upload to temp
  const tempFiles = await Promise.all(files.map((file) => uploadService.uploadTemp(file)));
  setTempIds(tempFiles.map((f) => f.tempId));
}, []);

// Phase 2: Commit on form submit
const onSubmit = async (data: FormData) => {
  await correspondenceService.create({
    ...data,
    tempFileIds,
  });
};
```

### API Client Setup

```typescript
// lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
});

// Auto-add Idempotency-Key
apiClient.interceptors.request.use((config) => {
  if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
    config.headers['Idempotency-Key'] = uuidv4();
  }
  return config;
});
```

### Anti-Patterns (ห้ามทำ)

- ❌ Fetch data ใน useEffect โดยตรง (ใช้ TanStack Query)
- ❌ Props drilling ลึกเกิน 3 levels
- ❌ Inline styles (ใช้ Tailwind)
- ❌ `console.log` ใน committed code
- ❌ `parseInt()` / `Number()` / `+` บน UUID values (ADR-019)
- ❌ `id ?? ''` fallback บน `publicId` (ใช้ `publicId ?? ''` หรือ fallback ไป business field)
- ❌ Expose `uuid` คู่กับ `publicId` ใน interface (ใช้ `publicId` อย่างเดียว)
- ❌ ใช้ index เป็น key ใน list
- ❌ Snake_case ใน form field names (ใช้ camelCase)
- ❌ Hardcode Thai/English string ใน component (ใช้ i18n keys)
- ❌ `any` type (strict mode)

---

See [debug-tricks.md](./debug-tricks.md) for:

- MCP endpoint for AI-assisted debugging
- Rebuild specific routes with `--debug-build-paths`
