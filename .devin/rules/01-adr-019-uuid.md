---
trigger: always_on
---

# ADR-019 UUID Strategy

## CRITICAL RULES

- **NEVER** use `parseInt()` on UUID values
- **NEVER** use `Number()` on UUID values
- **NEVER** use `+` operator on UUID values
- **ALWAYS** use `publicId` (string UUID) for API responses
- **NEVER** expose internal INT `id` in API responses (use `@Exclude()`)

## Identifier Types

| Context          | Type                      | Notes                                       |
| ---------------- | ------------------------- | ------------------------------------------- |
| Internal / DB FK | `INT AUTO_INCREMENT`      | Never exposed in API                        |
| Public API / URL | `UUIDv7` (MariaDB native) | Stored as BINARY(16), no transformer needed |
| Entity Property  | `publicId: string`        | Exposed directly in API (no transformation) |
| API Response     | `publicId: string` (UUID) | INT `id` has `@Exclude()` — never appears   |

## Backend Pattern (NestJS/TypeORM)

```typescript
// Entity
@Entity()
class Project extends UuidBaseEntity {
  @Column({ type: 'uuid' })
  publicId: string;  // UUID string, no transformation needed

  @PrimaryKey()
  @Exclude()
  id: number;  // Internal INT, never exposed
}

// API Response → { id: "019505a1-7c3e-7000-8000-abc123def456" }
// Uses publicId directly, no @Expose({ name: 'id' }) needed
```

## Frontend Pattern (Next.js)

```typescript
// ✅ CORRECT — Use publicId only
type ProjectOption = {
  publicId?: string; // No uuid, no id fallback
  projectName?: string;
};

// ❌ WRONG — Multiple identifiers cause confusion
type ProjectOption = {
  publicId?: string;
  uuid?: string; // Don't do this
  id?: number; // Don't do this
};

// ❌ NEVER use parseInt on UUID
parseInt(projectId); // "0195..." → 19 (WRONG!)

// ❌ NEVER use id ?? '' fallback
const value = c.publicId ?? c.id ?? ''; // Wrong!

// ✅ CORRECT — Use publicId only
const value = c.publicId; // "019505a1-7c3e-7000-8000-abc123def456"
```

## Related Documents

- `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`
- `specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md`
