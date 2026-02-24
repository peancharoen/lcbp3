# Frontend Development Guidelines

**สำหรับ:** NAP-DMS LCBP3 Frontend (Next.js + TypeScript)
**เวอร์ชัน:** 1.5.0
**อัปเดต:** 2025-12-01

---

## 🎯 หลักการพื้นฐาน

ระบบ Frontend ของเรามุ่งเน้น **User Experience First** - ประสบการณ์ผู้ใช้ที่ราบรื่น รวดเร็ว และใช้งานง่าย

### หลักการหลัก

1. **Type Safety:** ใช้ TypeScript Strict Mode ตลอดทั้งโปรเจกต์
2. **Responsive Design:** รองรับทุกขนาดหน้าจอ (Mobile-first approach)
3. **Performance:** Optimize การโหลดข้อมูล ใช้ Caching อย่างชาญฉลาด
4. **Accessibility:** ทุก Component ต้องรองรับ Screen Reader และ Keyboard Navigation
5. **Offline Support:** Auto-save Drafts และ Silent Token Refresh

---

## 📁 โครงสร้างโปรเจกต์

```
frontend/
├── app/                     # Next.js App Router
│   ├── (auth)/              # Auth routes (login, register)
│   ├── (dashboard)/         # Protected dashboard routes
│   ├── api/                 # API routes (NextAuth)
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── custom/              # Custom components
│   ├── forms/               # Form components
│   ├── layout/              # Layout components (Navbar, Sidebar)
│   └── tables/              # Data table components
├── hooks/                   # Custom React hooks (Root level)
├── lib/
│   ├── api/                 # API client (Axios)
│   ├── services/            # API service functions
│   ├── stores/              # Zustand stores
│   └── utils.ts             # Cn utility
├── providers/               # Context providers
├── public/                  # Static assets
├── styles/                  # Global styles
├── types/                   # TypeScript types & DTOs
└── middleware.ts            # Next.js Middleware
```

---

## 🎨 UI/UX Guidelines

### 1. Design System - Tailwind CSS

**ใช้ Tailwind Utilities เท่านั้น:**

```tsx
// ✅ Good
<div className="flex items-center gap-4 rounded-lg border p-4">
  <Button variant="outline">Cancel</Button>
</div>

// ❌ Bad - Inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

**Responsive Design:**

```tsx
<div
  className="
  grid
  grid-cols-1       /* Mobile: 1 column */
  md:grid-cols-2    /* Tablet: 2 columns */
  lg:grid-cols-3    /* Desktop: 3 columns */
  gap-4
"
>
  {items.map((item) => (
    <Card key={item.id} />
  ))}
</div>
```

### 2. shadcn/ui Components

**ใช้ shadcn/ui สำหรับ UI Components:**

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Dashboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>งานของฉัน</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>สร้างเอกสารใหม่</Button>
      </CardContent>
    </Card>
  );
}
```

### 3. Responsive Data Tables

**Mobile: Card View, Desktop: Table View**

```tsx
export function ResponsiveTable({ data }: { data: Correspondence[] }) {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เลขที่เอกสาร</TableHead>
              <TableHead>เรื่อง</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.doc_number}</TableCell>
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  <Badge>{item.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {data.map((item) => (
          <Card key={item.id}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  เลขที่เอกสาร
                </div>
                <div className="font-medium">{item.doc_number}</div>
                <div className="text-sm text-muted-foreground">เรื่อง</div>
                <div>{item.title}</div>
                <Badge>{item.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
```

---

## 🗄️ State Management

### 1. Server State - TanStack Query

**ใช้สำหรับข้อมูลจาก API:**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch data
export function useCorrespondences(projectId: string) {
  return useQuery({
    queryKey: ['correspondences', projectId],
    queryFn: () => correspondenceService.getAll(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation with optimistic update
export function useCreateCorrespondence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: correspondenceService.create,
    onMutate: async (newCorrespondence) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['correspondences'] });
      const previous = queryClient.getQueryData(['correspondences']);

      queryClient.setQueryData(['correspondences'], (old: Correspondence[] | undefined) => [
        ...(old || []),
        newCorrespondence,
      ]);

      return { previous };
    },
    onError: (err, newCorrespondence, context) => {
      // Rollback on error
      queryClient.setQueryData(['correspondences'], context?.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correspondences'] });
    },
  });
}
```

### 2. Form State - React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Schema Definition
const formSchema = z.object({
  title: z.string().min(1, 'กรุณาระบุหัวเรื่อง').max(500),
  project_id: z.string().uuid('กรุณาเลือกโปรเจกต์'),
  type_id: z.string().uuid('กรุณาเลือกประเภทเอกสาร'),
});

type FormData = z.infer<typeof formSchema>;

// Form Component
export function CorrespondenceForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      project_id: '',
      type_id: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    await createCorrespondence(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>หัวเรื่อง</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">บันทึก</Button>
      </form>
    </Form>
  );
}
```

### 3. UI State - Zustand

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Draft Store (with localStorage persistence)
interface DraftStore {
  drafts: Record<string, unknown>;
  saveDraft: (formKey: string, data: Record<string, unknown>) => void;
  loadDraft: (formKey: string) => Record<string, unknown> | undefined;
  clearDraft: (formKey: string) => void;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (formKey, data) =>
        set((state) => ({
          drafts: { ...state.drafts, [formKey]: data },
        })),
      loadDraft: (formKey) => get().drafts[formKey],
      clearDraft: (formKey) =>
        set((state) => {
          const { [formKey]: _, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'correspondence-drafts' }
  )
);
```

---

## 🔌 API Integration

### 1. Axios Client Setup

```typescript
// lib/api/client.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
});

// Request Interceptor - Add Auth & Idempotency
apiClient.interceptors.request.use((config) => {
  // Add JWT Token
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add Idempotency-Key for mutation requests
  if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
    config.headers['Idempotency-Key'] = uuidv4();
  }

  return config;
});

// Response Interceptor - Handle Errors & Token Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Auto refresh token on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const { data } = await axios.post('/auth/refresh', { refreshToken });

        localStorage.setItem('access_token', data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### 2. Service Layer

```typescript
// lib/services/correspondence.service.ts
import apiClient from '@/lib/api/client';
import type {
  Correspondence,
  CreateCorrespondenceDto,
  SearchCorrespondenceDto,
} from '@/types/dto/correspondence';

export const correspondenceService = {
  async getAll(params: SearchCorrespondenceDto): Promise<Correspondence[]> {
    const { data } = await apiClient.get('/correspondences', { params });
    return data;
  },

  async getById(id: string): Promise<Correspondence> {
    const { data } = await apiClient.get(`/correspondences/${id}`);
    return data;
  },

  async create(dto: CreateCorrespondenceDto): Promise<Correspondence> {
    const { data } = await apiClient.post('/correspondences', dto);
    return data;
  },

  async update(
    id: string,
    dto: Partial<CreateCorrespondenceDto>
  ): Promise<Correspondence> {
    const { data } = await apiClient.put(`/correspondences/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/correspondences/${id}`);
  },
};
```

---

## 📝 Dynamic Forms (JSON Schema)

### Dynamic Form Generator

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';

interface DynamicFormProps {
  schemaName: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function DynamicForm({ schemaName, onSubmit }: DynamicFormProps) {
  // Fetch JSON Schema from Backend
  const { data: schema } = useQuery({
    queryKey: ['json-schema', schemaName],
    queryFn: () => jsonSchemaService.getByName(schemaName),
  });

  // Generate Zod schema from JSON Schema
  const zodSchema = useMemo(() => {
    if (!schema) return null;
    return generateZodSchemaFromJsonSchema(schema.schema_definition);
  }, [schema]);

  const form = useForm({
    resolver: zodResolver(zodSchema!),
  });

  if (!schema) return <Skeleton />;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {Object.entries(schema.schema_definition.properties).map(
          ([key, prop]: [string, Record<string, unknown>]) => (
            <FormField
              key={key}
              control={form.control}
              name={key}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{prop.title || key}</FormLabel>
                  <FormControl>
                    {renderFieldByType(prop.type, field)}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )
        )}
        <Button type="submit">บันทึก</Button>
      </form>
    </Form>
  );
}

// Helper function to render different field types
function renderFieldByType(type: string, field: Record<string, unknown>) {
  switch (type) {
    case 'string':
      return <Input {...field} />;
    case 'number':
      return <Input type="number" {...field} />;
    case 'boolean':
      return <Switch {...field} />;
    // Add more types as needed
    default:
      return <Input {...field} />;
  }
}
```

---

## 📤 File Upload

### Drag & Drop File Upload

```tsx
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';

interface FileUploadZoneProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
}

export function FileUploadZone({
  onUpload,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = ['.pdf', '.dwg', '.docx', '.xlsx', '.zip'],
}: FileUploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onUpload(acceptedFiles);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors
        ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25'
        }
        hover:border-primary hover:bg-primary/5
      `}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        {isDragActive
          ? 'วางไฟล์ที่นี่...'
          : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        รองรับ: {acceptedTypes.join(', ')} (สูงสุด {maxFiles} ไฟล์,{' '}
        {maxSize / 1024 / 1024}MB/ไฟล์)
      </p>
    </div>
  );
}
```

---

## ✅ Testing Standards

### 1. Component Testing (Vitest + React Testing Library)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CorrespondenceForm } from './correspondence-form';

describe('CorrespondenceForm', () => {
  it('should validate required fields', async () => {
    const onSubmit = vi.fn();
    render(<CorrespondenceForm onSubmit={onSubmit} />);

    const submitButton = screen.getByRole('button', { name: /บันทึก/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText('กรุณาระบุหัวเรื่อง')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const onSubmit = vi.fn();
    render(<CorrespondenceForm onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText('หัวเรื่อง');
    fireEvent.change(titleInput, { target: { value: 'Test Correspondence' } });

    const submitButton = screen.getByRole('button', { name: /บันทึก/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test Correspondence' })
      );
    });
  });
});
```

### 2. E2E Testing (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Correspondence Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create new correspondence', async ({ page }) => {
    // Navigate to create page
    await page.click('text=สร้างเอกสาร');
    await page.waitForURL('/correspondences/new');

    // Fill form
    await page.fill('input[name="title"]', 'E2E Test Correspondence');
    await page.selectOption('select[name="project_id"]', { index: 1 });
    await page.selectOption('select[name="type_id"]', { index: 1 });

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('text=สร้างเอกสารสำเร็จ')).toBeVisible();
    await expect(page).toHaveURL(/\/correspondences\/[a-f0-9-]+/);
  });
});
```

---

## 🚫 Anti-Patterns (สิ่งที่ห้ามทำ)

1. ❌ **ห้ามใช้ Inline Styles** - ใช้ Tailwind เท่านั้น
2. ❌ **ห้าม Fetch Data ใน useEffect** - ใช้ TanStack Query
3. ❌ **ห้าม Props Drilling** - ใช้ Context หรือ Zustand
4. ❌ **ห้าม Any Type**
5. ❌ **ห้าม console.log** ใน Production
6. ❌ **ห้ามใช้ Index เป็น Key** ใน List
7. ❌ **ห้าม Mutation โดยตรง** - ใช้ TanStack Query Mutation

---

## 📚 เอกสารอ้างอิง

- [FullStack Guidelines](05-01-fullstack-js-guidelines.md)
- [Frontend Plan v1.8.0](../02-Architecture/02-02-software-architecture.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query)
- [shadcn/ui](https://ui.shadcn.com)

---

## 🔄 Update History

| Version | Date       | Changes                             |
| ------- | ---------- | ----------------------------------- |
| 1.5.0   | 2025-12-01 | Initial frontend guidelines created |
