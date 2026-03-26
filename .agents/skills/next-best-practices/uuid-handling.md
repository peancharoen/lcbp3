# UUID Handling (ADR-019)

**Project-specific: Hybrid Identifier Strategy for NAP-DMS**

This project uses ADR-019: INT Primary Key (internal) + UUIDv7 (public API). Frontend code must handle this correctly.

## The Pattern

| Source | Field Name | Type | Notes |
|--------|------------|------|-------|
| **API Response** | `id` | `string` (UUID) | Actually `publicId` exposed via `@Expose({ name: 'id' })` |
| **TypeScript Interface** | `publicId?: string` | UUID string | Use this for all references |
| **Fallback** | `id?: number` | INT (internal) | May be undefined due to `@Exclude()` |
| **Form Values** | `xxxUuid` | `string` | DTO field names: `projectUuid`, `contractUuid` |

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

### 2. Use `publicId ?? id` Pattern

```tsx
// types/project.ts
interface Project {
  id?: number;           // Internal INT (may be undefined)
  publicId?: string;     // UUID from API (use this)
  projectCode: string;
  projectName: string;
}

// Component usage
const projectOptions = projects.map((p) => ({
  label: `${p.projectName} (${p.projectCode})`,
  value: String(p.publicId ?? p.id ?? ''), // ADR-019 pattern
  key: String(p.publicId ?? p.id ?? ''),
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
        {contracts.map((c) => (
          <SelectItem 
            key={String(c.publicId ?? c.id ?? '')} 
            value={String(c.publicId ?? c.id ?? '')}
          >
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
        <span>{contract.contractName} ({contract.contractCode})</span>
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
// types/entities.ts
export interface BaseEntity {
  id?: number;           // Internal INT - may be undefined
  publicId?: string;     // UUID - use this for API calls
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
  projectId?: number;        // Internal INT FK
  projectUuid?: string;      // UUID for DTOs
  project?: Project;         // Relation
}

// DTOs
export interface CreateContractDto {
  projectUuid: string;       // Accept UUID from form
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
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
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

| Pitfall | Wrong | Right |
|---------|-------|-------|
| Assuming `entity.id` exists | `key={entity.id}` | `key={entity.publicId ?? entity.id}` |
| parseInt on UUID | `parseInt(projectId)` | `projectId` (string) |
| Field name mismatch | `name="project_id"` | `name="projectUuid"` |
| Missing fallback | `value={entity.publicId}` | `value={entity.publicId ?? entity.id ?? ''}` |

## Reference

- [ADR-019 Hybrid Identifier Strategy](../../../../specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)
- [Frontend Guidelines](../../../../specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md)
- [UUID Implementation Plan](../../../../specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md)

> **Warning**: Using `parseInt()` on UUID values causes data corruption. Always use UUID strings directly in API calls.
