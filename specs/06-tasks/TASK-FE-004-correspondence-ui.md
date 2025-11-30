# TASK-FE-004: Correspondence Management UI

**ID:** TASK-FE-004
**Title:** Correspondence List, Create, View & Edit UI
**Category:** Business Modules
**Priority:** P1 (High)
**Effort:** 5-7 days
**Dependencies:** TASK-FE-003, TASK-BE-005
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build complete UI for Correspondence Management including list view with filters, create/edit forms, detail view, and status workflows.

---

## 🎯 Objectives

1. Create correspondence list with pagination and filters
2. Implement create/edit forms with validation
3. Build detail view with attachments
4. Add status workflow actions (Submit, Approve, Reject)
5. Implement file upload for attachments
6. Add search and filtering

---

## ✅ Acceptance Criteria

- [ ] List displays correspondences with pagination
- [ ] Filter by status, date range, organization
- [ ] Create form validates all required fields
- [ ] File attachments upload successfully
- [ ] Detail view shows complete information
- [ ] Workflow actions work (Submit, Approve, Reject)
- [ ] Real-time status updates

---

## 🔧 Implementation Steps

### Step 1: Correspondence List Page

```typescript
// File: src/app/(dashboard)/correspondences/page.tsx
import { CorrespondenceList } from '@/components/correspondences/list';
import { CorrespondenceFilters } from '@/components/correspondences/filters';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getCorrespondences } from '@/lib/api/correspondences';

export default async function CorrespondencesPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; search?: string };
}) {
  const page = parseInt(searchParams.page || '1');
  const data = await getCorrespondences({
    page,
    status: searchParams.status,
    search: searchParams.search,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Correspondences</h1>
          <p className="text-gray-600 mt-1">
            Manage official letters and communications
          </p>
        </div>
        <Link href="/correspondences/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Correspondence
          </Button>
        </Link>
      </div>

      <CorrespondenceFilters />
      <CorrespondenceList data={data} />
    </div>
  );
}
```

### Step 2: Correspondence List Component

```typescript
// File: src/components/correspondences/list.tsx
'use client';

import { useState } from 'react';
import { Correspondence } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, Edit } from 'lucide-react';
import { Pagination } from '@/components/common/pagination';

interface CorrespondenceListProps {
  data: {
    items: Correspondence[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export function CorrespondenceList({ data }: CorrespondenceListProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      DRAFT: 'gray',
      PENDING: 'yellow',
      IN_REVIEW: 'blue',
      APPROVED: 'green',
      REJECTED: 'red',
    };
    return colors[status] || 'gray';
  };

  return (
    <div className="space-y-4">
      {data.items.map((item) => (
        <Card
          key={item.correspondence_id}
          className="p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">{item.subject}</h3>
                <Badge variant={getStatusColor(item.status)}>
                  {item.status}
                </Badge>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {item.description || 'No description'}
              </p>

              <div className="flex gap-6 text-sm text-gray-500">
                <span>
                  <strong>From:</strong> {item.from_organization?.org_name}
                </span>
                <span>
                  <strong>To:</strong> {item.to_organization?.org_name}
                </span>
                <span>
                  <strong>Date:</strong>{' '}
                  {format(new Date(item.created_at), 'dd MMM yyyy')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/correspondences/${item.correspondence_id}`}>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Button>
              </Link>
              {item.status === 'DRAFT' && (
                <Link href={`/correspondences/${item.correspondence_id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      ))}

      <Pagination
        currentPage={data.page}
        totalPages={data.totalPages}
        total={data.total}
      />
    </div>
  );
}
```

### Step 3: Create/Edit Form

```typescript
// File: src/app/(dashboard)/correspondences/new/page.tsx
import { CorrespondenceForm } from '@/components/correspondences/form';

export default function NewCorrespondencePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">New Correspondence</h1>
      <CorrespondenceForm />
    </div>
  );
}
```

```typescript
// File: src/components/correspondences/form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUpload } from '@/components/common/file-upload';
import { useRouter } from 'next/navigation';
import { correspondenceApi } from '@/lib/api/correspondences';

const correspondenceSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().optional(),
  document_type_id: z.number(),
  from_organization_id: z.number(),
  to_organization_id: z.number(),
  importance: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  attachments: z.array(z.instanceof(File)).optional(),
});

type FormData = z.infer<typeof correspondenceSchema>;

export function CorrespondenceForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(correspondenceSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await correspondenceApi.create(data);
      router.push('/correspondences');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      {/* Subject */}
      <div>
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" {...register('subject')} />
        {errors.subject && (
          <p className="text-sm text-red-600 mt-1">{errors.subject.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register('description')} rows={4} />
      </div>

      {/* From/To Organizations */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>From Organization *</Label>
          <Select
            onValueChange={(v) => setValue('from_organization_id', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {/* Populate from API */}
              <SelectItem value="1">กทท.</SelectItem>
              <SelectItem value="2">สค©.</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>To Organization *</Label>
          <Select
            onValueChange={(v) => setValue('to_organization_id', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">กทท.</SelectItem>
              <SelectItem value="2">สค©.</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Importance */}
      <div>
        <Label>Importance</Label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center">
            <input
              type="radio"
              value="NORMAL"
              {...register('importance')}
              defaultChecked
            />
            <span className="ml-2">Normal</span>
          </label>
          <label className="flex items-center">
            <input type="radio" value="HIGH" {...register('importance')} />
            <span className="ml-2">High</span>
          </label>
          <label className="flex items-center">
            <input type="radio" value="URGENT" {...register('importance')} />
            <span className="ml-2">Urgent</span>
          </label>
        </div>
      </div>

      {/* File Attachments */}
      <div>
        <Label>Attachments</Label>
        <FileUpload
          onFilesSelected={(files) => setValue('attachments', files)}
          maxFiles={10}
          accept=".pdf,.doc,.docx,.xls,.xlsx"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Correspondence'}
        </Button>
      </div>
    </form>
  );
}
```

### Step 4: Detail View

```typescript
// File: src/app/(dashboard)/correspondences/[id]/page.tsx
import { getCorrespondenceById } from '@/lib/api/correspondences';
import { CorrespondenceDetail } from '@/components/correspondences/detail';
import { notFound } from 'next/navigation';

export default async function CorrespondenceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const correspondence = await getCorrespondenceById(parseInt(params.id));

  if (!correspondence) {
    notFound();
  }

  return <CorrespondenceDetail data={correspondence} />;
}
```

---

## 📦 Deliverables

- [ ] List page with filters and pagination
- [ ] Create/Edit forms with validation
- [ ] Detail view with complete information
- [ ] File upload component
- [ ] Status workflow actions
- [ ] API client functions

---

## 🔗 Related Documents

- [ADR-013: Form Handling](../../05-decisions/ADR-013-form-handling-validation.md)
- [TASK-BE-005: Correspondence Module](./TASK-BE-005-correspondence-module.md)

---

**Created:** 2025-12-01
**Status:** Ready
