# TASK-FE-006: RFA Management UI

**ID:** TASK-FE-006
**Title:** RFA List, Create, View & Workflow UI
**Category:** Business Modules
**Priority:** P1 (High)
**Effort:** 5-7 days
**Dependencies:** TASK-FE-003, TASK-FE-005, TASK-BE-007
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build comprehensive UI for Request for Approval (RFA) management including list with filters, create/edit forms with items, detail view, and approval workflow.

---

## 🎯 Objectives

1. Create RFA list with status filtering
2. Implement RFA creation form with multiple items
3. Build detail view showing items and approval history
4. Add approval workflow UI (Approve/Reject with comments)
5. Implement revision management
6. Add response tracking

---

## ✅ Acceptance Criteria

- [ ] List displays RFAs with pagination and filters
- [ ] Create form allows adding multiple RFA items
- [ ] Detail view shows items, attachments, and workflow history
- [ ] Approve/Reject dialog with comments functional
- [ ] Revision history visible
- [ ] Response tracking works (Approved/Rejected/Approved with Comments)

---

## 🔧 Implementation Steps

### Step 1: RFA List Page

```typescript
// File: src/app/(dashboard)/rfas/page.tsx
import { RFAList } from '@/components/rfas/list';
import { RFAFilters } from '@/components/rfas/filters';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function RFAsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">RFAs (Request for Approval)</h1>
          <p className="text-gray-600 mt-1">
            Manage approval requests and submissions
          </p>
        </div>
        <Link href="/rfas/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New RFA
          </Button>
        </Link>
      </div>

      <RFAFilters />
      <RFAList />
    </div>
  );
}
```

### Step 2: RFA Form with Items

```typescript
// File: src/components/rfas/form.tsx
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

const rfaItemSchema = z.object({
  item_no: z.string(),
  description: z.string().min(5),
  quantity: z.number().min(0),
  unit: z.string(),
  drawing_reference: z.string().optional(),
});

const rfaSchema = z.object({
  subject: z.string().min(5),
  description: z.string().optional(),
  contract_id: z.number(),
  discipline_id: z.number(),
  items: z.array(rfaItemSchema).min(1, 'At least one item required'),
});

type RFAFormData = z.infer<typeof rfaSchema>;

export function RFAForm() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RFAFormData>({
    resolver: zodResolver(rfaSchema),
    defaultValues: {
      items: [{ item_no: '1', description: '', quantity: 0, unit: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const onSubmit = async (data: RFAFormData) => {
    console.log(data);
    // Submit to API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
      {/* Basic Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">RFA Information</h3>

        <div className="space-y-4">
          <div>
            <Label>Subject *</Label>
            <Input {...register('subject')} />
            {errors.subject && (
              <p className="text-sm text-red-600 mt-1">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div>
            <Label>Description</Label>
            <Input {...register('description')} />
          </div>
        </div>
      </Card>

      {/* RFA Items */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">RFA Items</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                item_no: (fields.length + 1).toString(),
                description: '',
                quantity: 0,
                unit: '',
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium">Item #{index + 1}</h4>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Item No.</Label>
                  <Input {...register(`items.${index}.item_no`)} />
                </div>
                <div className="col-span-2">
                  <Label>Description *</Label>
                  <Input {...register(`items.${index}.description`)} />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    {...register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {errors.items?.root && (
          <p className="text-sm text-red-600 mt-2">
            {errors.items.root.message}
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Create RFA</Button>
      </div>
    </form>
  );
}
```

### Step 3: RFA Detail with Approval Actions

```typescript
// File: src/components/rfas/detail.tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle } from 'lucide-react';

export function RFADetail({ data }: { data: any }) {
  const [approvalDialog, setApprovalDialog] = useState<
    'approve' | 'reject' | null
  >(null);
  const [comments, setComments] = useState('');

  const handleApproval = async (action: 'approve' | 'reject') => {
    // Call API
    console.log({ action, comments });
    setApprovalDialog(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{data.subject}</h1>
          <div className="flex gap-3 mt-2">
            <Badge>{data.status}</Badge>
            <span className="text-gray-600">RFA No: {data.rfa_number}</span>
          </div>
        </div>

        {data.status === 'PENDING' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-green-600"
              onClick={() => setApprovalDialog('approve')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() => setApprovalDialog('reject')}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* RFA Items */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">RFA Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Item No.</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-left">Unit</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item: any) => (
                <tr key={item.rfa_item_id} className="border-t">
                  <td className="px-4 py-3">{item.item_no}</td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3">{item.unit}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        item.status === 'APPROVED' ? 'success' : 'default'
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Approval Dialog */}
      <Dialog
        open={approvalDialog !== null}
        onOpenChange={() => setApprovalDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog === 'approve' ? 'Approve RFA' : 'Reject RFA'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Comments</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                placeholder="Enter your comments..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApprovalDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleApproval(approvalDialog!)}
                variant={
                  approvalDialog === 'approve' ? 'default' : 'destructive'
                }
              >
                {approvalDialog === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## 📦 Deliverables

- [ ] RFA list page with filters
- [ ] Create/Edit form with dynamic items
- [ ] Detail view with items table
- [ ] Approval workflow UI (Approve/Reject)
- [ ] Revision management
- [ ] Response tracking

---

## 🔗 Related Documents

- [TASK-BE-007: RFA Module](./TASK-BE-007-rfa-module.md)
- [ADR-013: Form Handling](../../05-decisions/ADR-013-form-handling-validation.md)

---

**Created:** 2025-12-01
**Status:** Ready
