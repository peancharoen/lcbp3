# UUID Handling (ADR-019) — March 2026 Pattern

**Project-specific: Hybrid Identifier Strategy for NAP-DMS**

This project uses ADR-019: INT Primary Key (internal) + UUIDv7 (public API). Frontend code must handle this correctly.

> **Updated pattern:** Backend exposes `publicId` directly — ไม่มี `@Expose({ name: 'id' })` rename แล้ว. Frontend ใช้ `publicId` ตรงๆ — ห้าม fallback ไป `id`.

## The Pattern

| Source                   | Field Name          | Type              | Notes                                                       |
| ------------------------ | ------------------- | ----------------- | ----------------------------------------------------------- |
| **API Response**         | `publicId`          | `string` (UUIDv7) | Exposed directly (no rename)                                |
| **TypeScript Interface** | `publicId?: string` | UUID string       | ใช้ตัวนี้เท่านั้น                                           |
| **Form DTO**             | `xxxUuid`           | `string`          | DTO field names: `projectUuid`, `contractUuid` (input only) |
| **URL param**            | `[publicId]`        | `string` (UUID)   | e.g. `/correspondences/[publicId]/page.tsx`                 |

## Critical Rules

### 1. NEVER Use `parseInt()` on UUID

```tsx
// ❌ WRONG - parseInt on UUID gives garbage
const id = parseInt(projectId); // "0195a1b2-..." → 195 (wrong!)

// ❌ WRONG - Number() on UUID
const id = Number(projectId); // NaN

// ❌ WRONG - Unary plus
const id = +projectId; // NaN

// ✅ CORRECT - Send UUID string directly to API
apiClient.get(`/projects/${projectId}`); // projectId is already UUID string
```

### 2. Use `publicId` Only — NO `id ?? ''` Fallback

```tsx
// ✅ CORRECT — types/project.ts
interface Project {
  publicId?: string; // UUID from API — ใช้ตัวนี้เท่านั้น
  projectCode: string;
  projectName: string;
}

// ✅ CORRECT — Component usage
const projectOptions = projects.map((p) => ({
  label: `${p.projectName} (${p.projectCode})`,
  value: p.publicId ?? '', // ADR-019 — ไม่ต้อง String() และไม่ไป id
  key: p.publicId ?? p.projectCode, // fallback ไป business field ได้
}));

// ❌ WRONG — pattern เก่า
const oldOptions = projects.map((p) => ({
  value: String(p.publicId ?? p.id ?? ''), // ❌ `id ?? ''` fallback
}));
```

### 3. Form Field Names (camelCase)

```tsx
// ❌ WRONG - snake_case doesn't match TypeScript interface
fields={[{ name: 'project_id', label: 'Project' }]}

// ✅ CORRECT - camelCase matches interface
fields={[{ name: 'projectUuid', label: 'Project' }]}

// Form submission
const onSubmit = (data: { projectUuid: string }) => {
  // projectUuid is UUID string - send as-is
  await apiClient.post('/contracts', data);
};
```

## Select Component Pattern

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ContractSelectProps {
  contracts: Contract[];
  value: string;
  onChange: (value: string) => void;
}

export function ContractSelect({ contracts, value, onChange }: ContractSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="เลือกสัญญา" />
      </SelectTrigger>
      <SelectContent>
        {contracts
          .filter((c) => !!c.publicId) // กรอง contract ที่มี publicId เท่านั้น
          .map((c) => (
            <SelectItem key={c.publicId} value={c.publicId!}>
              {c.contractName} ({c.contractCode})
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
```

## Data Table Pattern

```tsx
// Show relation columns with UUID entities
const columns: ColumnDef<Discipline>[] = [
  {
    accessorKey: 'disciplineCode',
    header: 'Code',
  },
  {
    accessorKey: 'contract',
    header: 'Contract',
    cell: ({ row }) => {
      const contract = row.original.contract;
      return contract ? (
        <span>
          {contract.contractName} ({contract.contractCode})
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
];
```

## API Service Pattern

```tsx
// lib/services/contract.service.ts
export const contractService = {
  async getById(uuid: string): Promise<Contract> {
    // Send UUID string directly - backend resolves to INT
    const { data } = await apiClient.get(`/contracts/${uuid}`);
    return data;
  },

  async create(dto: CreateContractDto): Promise<Contract> {
    // DTO contains projectUuid (UUID string)
    const { data } = await apiClient.post('/contracts', dto);
    return data;
  },

  async update(uuid: string, dto: Partial<CreateContractDto>): Promise<Contract> {
    const { data } = await apiClient.put(`/contracts/${uuid}`, dto);
    return data;
  },

  async delete(uuid: string): Promise<void> {
    await apiClient.delete(`/contracts/${uuid}`);
  },
};
```

## TypeScript Interfaces

```tsx
// ✅ CORRECT — types/entities.ts
export interface BaseEntity {
  publicId?: string; // UUID — ใช้ตัวนี้เท่านั้น (ไม่มี INT id ใน interface)
  createdAt?: string;
  updatedAt?: string;
}

export interface Project extends BaseEntity {
  projectCode: string;
  projectName: string;
  description?: string;
}

export interface Contract extends BaseEntity {
  contractCode: string;
  contractName: string;
  project?: Project; // Relation (nested entity)
}

// DTO (input only — รับ UUID จาก form)
export interface CreateContractDto {
  projectUuid: string; // UUID string from select
  contractCode: string;
  contractName: string;
}
```

## Form with React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  projectUuid: z.string().uuid('กรุณาเลือกโปรเจกต์'),
  contractCode: z.string().min(1, 'กรุณาระบุรหัสสัญญา'),
  contractName: z.string().min(1, 'กรุณาระบุชื่อสัญญา'),
});

type FormData = z.infer<typeof formSchema>;

export function ContractForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectUuid: '',
      contractCode: '',
      contractName: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    // Send UUID strings directly
    await contractService.create(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>{/* Form fields */}</form>
    </Form>
  );
}
```

## URL Parameters

```tsx
// app/contracts/[id]/page.tsx
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // id is UUID string from URL
  const contract = await contractService.getById(id);

  return <ContractDetail contract={contract} />;
}
```

## Common Pitfalls

| Pitfall                      | ❌ Wrong                                         | ✅ Right                          |
| ---------------------------- | ------------------------------------------------ | --------------------------------- |
| Using INT `id`               | `key={entity.id}`                                | `key={entity.publicId}`           |
| parseInt on UUID             | `parseInt(projectId)`                            | `projectId` (string)              |
| Field name mismatch          | `name="project_id"`                              | `name="projectUuid"`              |
| `id ?? ''` fallback          | `value={publicId ?? id ?? ''}`                   | `value={publicId ?? ''}`          |
| `uuid` + `publicId` together | `interface { uuid?: string; publicId?: string }` | `interface { publicId?: string }` |

## Reference

- [ADR-019 Hybrid Identifier Strategy](../../../../specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)
- [Frontend Guidelines](../../../../specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md)
- [UUID Implementation Plan](../../../../specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md)

> **Warning**: Using `parseInt()` on UUID values causes data corruption. Always use UUID strings directly in API calls.
