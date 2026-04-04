---
trigger: always_on
globs:
  - "frontend/**/*.tsx"
  - "frontend/**/*.ts"
  - "frontend/**/*.css"
---

# Frontend Patterns (Next.js)

## Form Handling

- **RHF** (React Hook Form) for form management
- **Zod** for validation schema
- **TanStack Query** for server state

## UUID Handling

```typescript
// ✅ CORRECT - Use publicId only
interface ProjectOption {
  publicId?: string;
  projectName?: string;
}

// Select options
const options = contracts.map(c => ({
  label: `${c.contractName} (${c.contractCode})`,
  value: c.publicId!, // Use publicId, no fallback to id
}));

// ❌ WRONG - Never use these patterns
const value = c.publicId ?? c.id ?? ''; // Wrong!
const id = parseInt(projectId); // Wrong - parseInt on UUID!
```

## API Client Pattern

```typescript
// Use publicId directly in API calls
const contract = await contractService.getById(publicId);

// Form submission with UUID
const onSubmit = async (data: FormData) => {
  await correspondenceService.create({
    contractUuid: selectedContract.publicId!, // UUID string
    // ... other fields
  });
};
```

## Full Guidelines

`specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`
