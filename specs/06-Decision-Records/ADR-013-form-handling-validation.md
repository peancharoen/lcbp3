# ADR-013: Form Handling & Validation Strategy

**Status:** ✅ Accepted
**Date:** 2026-02-24
**Decision Makers:** Frontend Team
**Related Documents:** [Frontend Guidelines](../05-Engineering-Guidelines/05-03-frontend-guidelines.md)
**Version Applicability:** v1.8.0+
**Next Review:** 2026-08-01 (6-month cycle)

---

## Gap Analysis & Requirement Linking

### ปิด Gap จาก Requirements:

| Gap/Requirement | แหล่งที่มา | วิธีการแก้ไขใน ADR นี้ |
|----------------|-------------|-------------------|
| **Form Validation** | [Product Vision](../00-overview/00-03-product-vision.md) - Data Integrity | React Hook Form + Zod validation |
| **Performance Optimization** | [Acceptance Criteria](../01-Requirements/01-05-acceptance-criteria.md) - AC-UI-002 | Uncontrolled components for minimal re-renders |
| **Type Safety** | [Engineering Guidelines](../05-Engineering-Guidelines/05-01-fullstack-js-guidelines.md) - TypeScript | Zod schema to TypeScript types |
| **Developer Experience** | [Frontend Guidelines](../05-Engineering-Guidelines/05-03-frontend-guidelines.md) - DX | Clean API with minimal boilerplate |
| **Bundle Size Constraints** | [Architecture](../02-architecture/02-02-software-architecture.md) - Performance | Lightweight solution (8.5kb) |

### แก้ไขความขัดแย้ง:

- **Conflict:** Performance vs. Developer Experience (Formik vs. RHF)
- **Resolution:** Chose React Hook Form for performance and type safety
- **Trade-off:** Learning curve for uncontrolled components vs. Better performance

---

## Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ):

| Component | ผลกระทบ | ความสำคัญ |
|-----------|----------|-----------|
| **Form Components** | All forms use RHF + Zod | 🔴 Critical |
| **Validation Schemas** | Zod schemas for all forms | 🔴 Critical |
| **API Routes** | Server-side validation | 🔴 Critical |
| **UI Components** | FormField wrapper components | 🟡 Important |
| **File Upload** | RHF integration for file handling | 🟡 Important |
| **Dynamic Forms** | useFieldArray for complex forms | 🟡 Important |
| **Type Definitions** | Form types from Zod schemas | 🟡 Important |
| **Testing Setup** | Form testing utilities | 🟢 Guidelines |
| **Documentation** | Form patterns and examples | 🟢 Guidelines |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ):

#### Frontend (Next.js)
- [x] Install React Hook Form + Zod
- [x] Create validation schemas for all forms
- [x] Update all form components to use RHF
- [x] Create reusable FormField components
- [x] Implement file upload with RHF
- [x] Add dynamic form patterns (useFieldArray)
- [x] Setup form testing utilities

#### Backend (NestJS)
- [x] Sync validation logic with frontend schemas
- [x] Update DTOs to match Zod schemas
- [x] Add proper error responses for validation failures

#### Architecture
- [x] Document form patterns
- [x] Create form component templates
- [x] Define validation strategy across stack

---

## Context and Problem Statement

ระบบ LCBP3-DMS มี Forms จำนวนมาก (Create/Edit Correspondence, RFA, Drawings) ต้องการวิธีจัดการ Forms ที่มี Performance ดี Validation ชัดเจน และ Developer Experience สูง

### ปัญหาที่ต้องแก้:

1. **Form State Management:** จัดการ Form state อย่างไร
2. **Validation:** Validate client-side และ server-side อย่างไร
3. **Error Handling:** แสดง Error messages อย่างไร
4. **Performance:** Forms ขนาดใหญ่ไม่ช้า
5. **Type Safety:** Type-safe forms with TypeScript

---

## Decision Drivers

- ✅ **Type Safety:** TypeScript support เต็มรูปแบบ
- ⚡ **Performance:** Re-render minimal
- 🎯 **DX:** Developer Experience ดี
- 📝 **Validation:** Schema-based validation
- 🔄 **Reusability:** Reuse validation schema
- 🎨 **Flexibility:** ปรับแต่งได้ง่าย

---

## Considered Options

### Option 1: Formik

**Pros:**

- ✅ Popular และ Mature
- ✅ Documentation ดี
- ✅ Yup validation

**Cons:**

- ❌ Performance issues (re-renders)
- ❌ Bundle size ใหญ่
- ❌ TypeScript support ไม่ดีมาก
- ❌ Not actively maintained

### Option 2: Plain React State

```typescript
const [formData, setFormData] = useState({});
```

**Pros:**

- ✅ Simple
- ✅ No dependencies

**Cons:**

- ❌ Boilerplate code มาก
- ❌ ต้องจัดการ Validation เอง
- ❌ Error handling ซับซ้อน
- ❌ Performance issues

### Option 3: React Hook Form + Zod

**Pros:**

- ✅ **Performance:** Uncontrolled components (minimal re-renders)
- ✅ **TypeScript First:** Full type safety
- ✅ **Small Bundle:** ~8.5kb
- ✅ **Schema Validation:** Zod integration
- ✅ **DX:** Clean API
- ✅ **Actively Maintained**

**Cons:**

- ❌ Learning curve (uncontrolled approach)
- ❌ Complex forms ต้องใช้ Controller

---

## Decision Outcome

**Chosen Option:** **Option 3 - React Hook Form + Zod**

### Rationale

1. **Performance:** Uncontrolled components = minimal re-renders
2. **Type Safety:** Zod schemas → TypeScript types → Runtime validation
3. **Bundle Size:** เล็กมาก (8.5kb)
4. **Developer Experience:** API สะอาด ใช้งานง่าย
5. **Validation Reuse:** Validation schema ใช้ร่วมกับ Backend ได้

---

## Implementation Details

### 1. Install Dependencies

```bash
npm install react-hook-form zod @hookform/resolvers
```

### 2. Define Zod Schema

```typescript
// File: lib/validations/correspondence.ts
import { z } from 'zod';

export const correspondenceSchema = z.object({
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(255, 'Subject must not exceed 255 characters'),

  description: z.string().min(10, 'Description must be at least 10 characters').optional(),

  document_type_id: z.number({
    required_error: 'Document type is required',
  }),

  from_organization_id: z.number({
    required_error: 'From organization is required',
  }),

  to_organization_id: z.number({
    required_error: 'To organization is required',
  }),

  importance: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),

  attachments: z.array(z.instanceof(File)).optional(),
});

// Export TypeScript type
export type CorrespondenceFormData = z.infer<typeof correspondenceSchema>;
```

### 3. Create Form Component

```typescript
// File: components/correspondences/create-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  correspondenceSchema,
  type CorrespondenceFormData,
} from '@/lib/validations/correspondence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateCorrespondenceForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<CorrespondenceFormData>({
    resolver: zodResolver(correspondenceSchema),
    defaultValues: {
      importance: 'NORMAL',
    },
  });

  const onSubmit = async (data: CorrespondenceFormData) => {
    try {
      const response = await fetch('/api/correspondences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create');

      // Success - redirect
      window.location.href = '/correspondences';
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Subject */}
      <div>
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          {...register('subject')}
          placeholder="Enter subject"
        />
        {errors.subject && (
          <p className="text-sm text-red-600 mt-1">{errors.subject.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Enter description"
          rows={4}
        />
        {errors.description && (
          <p className="text-sm text-red-600 mt-1">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Document Type (Select) */}
      <div>
        <Label>Document Type *</Label>
        <Select
          onValueChange={(value) =>
            setValue('document_type_id', parseInt(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Internal Letter</SelectItem>
            <SelectItem value="2">External Letter</SelectItem>
          </SelectContent>
        </Select>
        {errors.document_type_id && (
          <p className="text-sm text-red-600 mt-1">
            {errors.document_type_id.message}
          </p>
        )}
      </div>

      {/* Importance (Radio) */}
      <div>
        <Label>Importance</Label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center">
            <input type="radio" value="NORMAL" {...register('importance')} />
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

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
```

### 4. Reusable Form Field Component

```typescript
// File: components/ui/form-field.tsx
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { UseFormRegister, FieldError } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  required?: boolean;
  placeholder?: string;
}

export function FormField({
  label,
  name,
  type = 'text',
  register,
  error,
  required = false,
  placeholder,
}: FormFieldProps) {
  return (
    <div>
      <Label htmlFor={name}>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      <Input
        id={name}
        type={type}
        {...register(name)}
        placeholder={placeholder}
        className={error ? 'border-red-600' : ''}
      />
      {error && <p className="text-sm text-red-600 mt-1">{error.message}</p>}
    </div>
  );
}
```

### 5. File Upload Handling

```typescript
// File: components/correspondences/file-upload.tsx
'use client';

import { useState } from 'react';
import { UseFormSetValue } from 'react-hook-form';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  setValue: UseFormSetValue<any>;
  fieldName: string;
}

export function FileUpload({ setValue, fieldName }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setValue(fieldName, selectedFiles);
  };

  return (
    <div>
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload">
        <Button type="button" variant="outline" asChild>
          <span>Choose Files</span>
        </Button>
      </label>

      {files.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          {files.map((file, i) => (
            <div key={i}>{file.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6. Server-Side Validation

```typescript
// File: app/api/correspondences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { correspondenceSchema } from '@/lib/validations/correspondence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with same Zod schema
    const validated = correspondenceSchema.parse(body);

    // Create correspondence
    // ...

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## Form Patterns

### Dynamic Fields

```typescript
import { useFieldArray } from 'react-hook-form';

const { fields, append, remove } = useFieldArray({
  control,
  name: 'items', // RFA items
});

// Add item
append({ description: '', quantity: 0 });

// Remove item
remove(index);
```

### Controlled Components

```typescript
import { Controller } from 'react-hook-form';

<Controller
  name="discipline_id"
  control={control}
  render={({ field }) => (
    <Select onValueChange={field.onChange} value={field.value}>
      {/* Options */}
    </Select>
  )}
/>;
```

---

## Consequences

### Positive Consequences

1. ✅ **Performance:** Minimal re-renders (uncontrolled)
2. ✅ **Type Safety:** Full TypeScript support
3. ✅ **Validation Reuse:** Same schema for client & server
4. ✅ **Small Bundle:** ~8.5kb only
5. ✅ **Clean Code:** Less boilerplate
6. ✅ **Error Handling:** Built-in error states

### Negative Consequences

1. ❌ **Learning Curve:** Uncontrolled approach ต่างจาก Formik
2. ❌ **Complex Forms:** ต้องใช้ Controller บางครั้ง

### Mitigation Strategies

- **Documentation:** เขียน Form patterns และ Examples
- **Reusable Components:** สร้าง FormField wrapper
- **Code Review:** Review forms ให้ใช้ best practices
- **Backend Sync:** ถึงแม้ฝั่ง Frontend จะใช้ `Zod` แต่ฝั่ง Backend (NestJS) ใช้ `class-validator` กับ `class-transformer` เป็นหลักใน DTOs ควรตรวจสอบ Validation Logic ทั้ง 2 ฝั่งให้อัปเดตตรงกันเสมอผ่าน Type Definitions หรือ Documentation

---

## ADR Review Cycle

### Core Principle Review Schedule
- **Review Frequency:** ทุก 6 เดือน (กุมภาพันธ์ และ สิงหาคม)
- **Trigger Events:**
  - Major version upgrade (v1.9.0, v2.0.0)
  - Performance issues requiring form optimization
  - New form patterns or requirements
  - React Hook Form/Zod major updates

### Review Checklist
- [ ] Form performance metrics acceptable
- [ ] Validation schemas still meet requirements
- [ ] Type safety maintained across forms
- [ ] Bundle size within limits
- [ ] Cross-document dependencies still valid
- [ ] New form libraries or patterns to consider
- [ ] Backend validation sync maintained

### Version Dependency Matrix

| System Version | ADR Version | Required Changes | Status |
|----------------|-------------|------------------|---------|
| v1.8.0 - v1.8.5 | ADR-013 v1.0 | Base RHF + Zod implementation | ✅ Complete |
| v1.9.0+ | ADR-013 v1.1 | Review form performance and patterns | 📋 Planned |
| v2.0.0+ | ADR-013 v2.0 | Consider new form technologies | 📋 Future |

---

## Related ADRs

- [ADR-007: API Design & Error Handling](./ADR-007-api-design-error-handling.md)
- [ADR-012: UI Component Library](./ADR-012-ui-component-library.md)

---

## References

- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)

---

**Document Version:** v1.0
**Last Updated:** 2026-02-24
**Next Review:** 2026-08-01 (6-month cycle)
**Version Applicability:** LCBP3 v1.8.0+

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| v1.0 | 2026-02-24 | Initial ADR creation with form handling strategy | Frontend Team |
| v1.1 | 2026-04-04 | Added structured templates: Impact Analysis, Gap Linking, Version Dependency, Review Cycle | System Architect |
