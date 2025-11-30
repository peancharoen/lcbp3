# TASK-FE-007: Drawing Management UI

**ID:** TASK-FE-007
**Title:** Drawing List, Upload & Revision Management UI
**Category:** Business Modules
**Priority:** P2 (Medium)
**Effort:** 4-6 days
**Dependencies:** TASK-FE-003, TASK-FE-005, TASK-BE-008
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build UI for Drawing Management including Contract Drawings and Shop Drawings with revision tracking, file preview, and comparison features.

---

## 🎯 Objectives

1. Create drawing list with category filtering (Contract/Shop)
2. Implement drawing upload with metadata
3. Build revision management UI
4. Add file preview/download functionality
5. Implement drawing comparison (side-by-side)
6. Add version history view

---

## ✅ Acceptance Criteria

- [ ] List displays drawings grouped by type
- [ ] Upload form accepts drawing files (PDF, DWG)
- [ ] Revision history visible with compare feature
- [ ] File preview works for PDF
- [ ] Download functionality working
- [ ] Metadata (discipline, sheet number) editable

---

## 🔧 Implementation Steps

### Step 1: Drawing List with Category Tabs

```typescript
// File: src/app/(dashboard)/drawings/page.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DrawingList } from '@/components/drawings/list';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import Link from 'next/link';

export default function DrawingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drawings</h1>
          <p className="text-gray-600 mt-1">
            Manage contract and shop drawings
          </p>
        </div>
        <Link href="/drawings/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Drawing
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="contract">
        <TabsList>
          <TabsTrigger value="contract">Contract Drawings</TabsTrigger>
          <TabsTrigger value="shop">Shop Drawings</TabsTrigger>
        </TabsList>

        <TabsContent value="contract">
          <DrawingList type="CONTRACT" />
        </TabsContent>

        <TabsContent value="shop">
          <DrawingList type="SHOP" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 2: Drawing Card with Preview

```typescript
// File: src/components/drawings/card.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, GitCompare } from 'lucide-react';
import Link from 'next/link';

export function DrawingCard({ drawing }: { drawing: any }) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-32 h-32 bg-gray-100 rounded flex items-center justify-center">
          <FileText className="h-16 w-16 text-gray-400" />
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold">
                {drawing.drawing_number}
              </h3>
              <p className="text-sm text-gray-600">{drawing.title}</p>
            </div>
            <Badge>{drawing.discipline?.discipline_code}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
            <div>
              <strong>Sheet:</strong> {drawing.sheet_number}
            </div>
            <div>
              <strong>Revision:</strong> {drawing.current_revision}
            </div>
            <div>
              <strong>Scale:</strong> {drawing.scale || 'N/A'}
            </div>
            <div>
              <strong>Date:</strong>{' '}
              {new Date(drawing.issue_date).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2">
            <Link href={`/drawings/${drawing.drawing_id}`}>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {drawing.revision_count > 1 && (
              <Button variant="outline" size="sm">
                <GitCompare className="mr-2 h-4 w-4" />
                Compare
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
```

### Step 3: Drawing Upload Form

```typescript
// File: src/app/(dashboard)/drawings/upload/page.tsx
import { DrawingUploadForm } from '@/components/drawings/upload-form';

export default function DrawingUploadPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Upload Drawing</h1>
      <DrawingUploadForm />
    </div>
  );
}
```

```typescript
// File: src/components/drawings/upload-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';

const drawingSchema = z.object({
  drawing_type: z.enum(['CONTRACT', 'SHOP']),
  drawing_number: z.string().min(1),
  title: z.string().min(5),
  discipline_id: z.number(),
  sheet_number: z.string(),
  scale: z.string().optional(),
  file: z.instanceof(File),
});

type DrawingFormData = z.infer<typeof drawingSchema>;

export function DrawingUploadForm() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DrawingFormData>({
    resolver: zodResolver(drawingSchema),
  });

  const onSubmit = async (data: DrawingFormData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Upload to API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drawing Information</h3>

        <div className="space-y-4">
          <div>
            <Label>Drawing Type *</Label>
            <Select onValueChange={(v) => setValue('drawing_type', v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTRACT">Contract Drawing</SelectItem>
                <SelectItem value="SHOP">Shop Drawing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Drawing Number *</Label>
              <Input {...register('drawing_number')} />
            </div>
            <div>
              <Label>Sheet Number</Label>
              <Input {...register('sheet_number')} />
            </div>
          </div>

          <div>
            <Label>Title *</Label>
            <Input {...register('title')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Discipline</Label>
              <Select
                onValueChange={(v) => setValue('discipline_id', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">STR - Structure</SelectItem>
                  <SelectItem value="2">ARC - Architecture</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scale</Label>
              <Input {...register('scale')} placeholder="1:100" />
            </div>
          </div>

          <div>
            <Label>Drawing File *</Label>
            <Input
              type="file"
              accept=".pdf,.dwg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setValue('file', file);
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Accepted: PDF, DWG (Max 50MB)
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Upload Drawing</Button>
      </div>
    </form>
  );
}
```

### Step 4: Revision History

```typescript
// File: src/components/drawings/revision-history.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function RevisionHistory({ revisions }: { revisions: any[] }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Revision History</h3>

      <div className="space-y-3">
        {revisions.map((rev) => (
          <div
            key={rev.revision_id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <Badge variant={rev.is_current ? 'default' : 'outline'}>
                  Rev. {rev.revision_number}
                </Badge>
                {rev.is_current && (
                  <span className="text-xs text-green-600 font-medium">
                    CURRENT
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {rev.revision_description}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(rev.revision_date).toLocaleDateString()} by{' '}
                {rev.revised_by_name}
              </p>
            </div>

            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

---

## 📦 Deliverables

- [ ] Drawing list with Contract/Shop tabs
- [ ] Upload form with file validation
- [ ] Drawing cards with preview
- [ ] Revision history view
- [ ] File download functionality
- [ ] Comparison feature (optional)

---

## 🔗 Related Documents

- [TASK-BE-008: Drawing Module](./TASK-BE-008-drawing-module.md)

---

**Created:** 2025-12-01
**Status:** Ready
