# Implementation Plan: Hybrid UUID Strategy (ADR-019)

**Version:** 1.8.1
**Created:** 2026-03-16
**Related ADR:** [ADR-019](../06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)

---

## Overview

This document outlines the step-by-step implementation plan to integrate UUIDv7 public identifiers into the LCBP3-DMS backend, following the hybrid strategy defined in ADR-019.

**Scope:** 14 public-facing tables now have `uuid UUID` columns (MariaDB native type, stored as BINARY(16) internally) in the schema. This plan covers backend code changes to expose UUIDs through the API while keeping INT PKs for internal operations.

---

## Phase 1: Database Foundation (✅ COMPLETED — 2026-03-16)

- [x] Create ADR-019 document
- [x] Add `uuid UUID` columns (MariaDB native type) to 14 public-facing tables in schema SQL
- [x] Add UNIQUE INDEX on each uuid column
- [x] Update data dictionary with uuid column documentation
- [x] Update AGENTS.md with ADR-019 reference

### Affected Tables (14)

| #   | Table                     | PK Column | UUID Index                         |
| --- | ------------------------- | --------- | ---------------------------------- |
| 1   | organizations             | id        | idx_organizations_uuid             |
| 2   | projects                  | id        | idx_projects_uuid                  |
| 3   | contracts                 | id        | idx_contracts_uuid                 |
| 4   | users                     | user_id   | idx_users_uuid                     |
| 5   | correspondences           | id        | idx_correspondences_uuid           |
| 6   | correspondence_revisions  | id        | idx_correspondence_revisions_uuid  |
| 7   | circulations              | id        | idx_circulations_uuid              |
| 8   | shop_drawings             | id        | idx_shop_drawings_uuid             |
| 9   | shop_drawing_revisions    | id        | idx_shop_drawing_revisions_uuid    |
| 10  | contract_drawings         | id        | idx_contract_drawings_uuid         |
| 11  | asbuilt_drawings          | id        | idx_asbuilt_drawings_uuid          |
| 12  | asbuilt_drawing_revisions | id        | idx_asbuilt_drawing_revisions_uuid |
| 13  | attachments               | id        | idx_attachments_uuid               |
| 14  | notifications             | id        | idx_notifications_uuid             |

### Excluded Tables (Shared-PK / Junction — inherit UUID from parent)

- `rfas` — shared PK with `correspondences`
- `rfa_revisions` — shared PK with `correspondence_revisions`
- `transmittals` — shared PK with `correspondences`
- `rfa_items` — junction table (composite PK, no own identity)

---

## Phase 2: Backend — TypeORM Base Entity & UUID Utilities (✅ COMPLETED)

> **Simplified by MariaDB Native UUID Type:** MariaDB 10.7+ stores UUID as `BINARY(16)` internally but auto-converts to/from string format. No manual binary conversion utilities or TypeORM transformers needed.

### 2.1 Create Base Entity with UUID

**File:** `backend/src/common/entities/uuid-base.entity.ts`

```typescript
import { Column, BeforeInsert } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export abstract class UuidBaseEntity {
  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  uuid: string;

  @BeforeInsert()
  generateUuid(): void {
    if (!this.uuid) {
      this.uuid = uuidv7();
    }
  }
}
```

> **Note:** MariaDB native `UUID` type handles string ↔ binary conversion automatically.
> TypeORM reads/writes UUID as standard string format (8-4-4-4-12) — no transformer required.
> DB `DEFAULT UUID()` generates UUID v1 as fallback; app generates UUIDv7 via `@BeforeInsert()`.

### 2.2 Install uuid Package

```bash
cd backend
npm install uuid
npm install -D @types/uuid
```

---

## Phase 3: Backend — Update Existing Entities (✅ COMPLETED)

For each of the 14 public-facing entities, extend or mix in the UUID column:

### Pattern: Extend UuidBaseEntity

```typescript
// Example: correspondence.entity.ts
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UuidBaseEntity } from '../../common/entities/uuid-base.entity';

@Entity('correspondences')
export class Correspondence extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // ... existing columns (uuid + @BeforeInsert inherited from UuidBaseEntity)
}
```

### Entities to Update

| Entity File                          | Table                     |
| ------------------------------------ | ------------------------- |
| `organization.entity.ts`             | organizations             |
| `project.entity.ts`                  | projects                  |
| `contract.entity.ts`                 | contracts                 |
| `user.entity.ts`                     | users                     |
| `correspondence.entity.ts`           | correspondences           |
| `correspondence-revision.entity.ts`  | correspondence_revisions  |
| `circulation.entity.ts`              | circulations              |
| `shop-drawing.entity.ts`             | shop_drawings             |
| `shop-drawing-revision.entity.ts`    | shop_drawing_revisions    |
| `contract-drawing.entity.ts`         | contract_drawings         |
| `asbuilt-drawing.entity.ts`          | asbuilt_drawings          |
| `asbuilt-drawing-revision.entity.ts` | asbuilt_drawing_revisions |
| `attachment.entity.ts`               | attachments               |
| `notification.entity.ts`             | notifications             |

---

## Phase 4: Backend — API Layer Changes (✅ COMPLETED)

### 4.1 UUID Pipe (Parameter Validation)

**File:** `backend/src/common/pipes/parse-uuid.pipe.ts`

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!uuidValidate(value) || uuidVersion(value) !== 7) {
      throw new BadRequestException(`Invalid UUID: ${value}`);
    }
    return value;
  }
}
```

### 4.2 Controller Pattern — UUID in URLs

```typescript
// BEFORE (INT):  GET /api/correspondences/123
// AFTER (UUID):  GET /api/correspondences/01912345-6789-7abc-...

@Get(':uuid')
findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
  return this.service.findByUuid(uuid);
}
```

### 4.3 Service Pattern — Internal UUID Lookup

```typescript
async findByUuid(uuid: string): Promise<CorrespondenceDto> {
  const entity = await this.repository.findOne({
    where: { uuid },
    relations: ['revisions', 'recipients'],
  });
  if (!entity) throw new NotFoundException();
  return this.mapToDto(entity);
}
```

### 4.4 DTO Pattern — UUID Exposure

```typescript
// Response DTO exposes uuid, hides id
export class CorrespondenceResponseDto {
  uuid: string; // ✅ Public identifier
  correspondenceNumber: string;
  // id: number;             // ❌ Never expose INT id
}
```

### 4.5 Migration Helper — findByUuidOrId

During transition, support both identifiers:

```typescript
async findByUuidOrId(identifier: string): Promise<Entity> {
  const isUuid = uuidValidate(identifier);
  if (isUuid) {
    return this.repository.findOne({ where: { uuid: identifier } });
  }
  // Fallback to INT (internal/admin use only)
  const id = parseInt(identifier, 10);
  if (isNaN(id)) throw new BadRequestException();
  return this.repository.findOne({ where: { id } });
}
```

---

## Phase 5: Frontend — UUID Integration (🔄 PARTIAL — see 5.4)

### 5.1 API Client Updates (✅ COMPLETED)

- [x] Update all API calls to use UUID in URL paths instead of INT id
- [x] Update TanStack Query cache keys to use UUID
- [x] Service functions renamed `getById` → `getByUuid` (12 services)
- [x] Hooks updated with UUID-based cache keys and mutation params

### 5.2 Route Parameters (✅ COMPLETED)

```typescript
// BEFORE: /correspondences/[id]
// AFTER:  /correspondences/[uuid]
```

- [x] `/correspondences/[uuid]`, `/circulation/[uuid]`, `/drawings/[uuid]` migrated
- [ ] `/rfas/[id]` and `/transmittals/[id]` — NOT migrated (separate feature scope)

### 5.3 Form Handling (✅ PARTIAL)

- [x] Drawing search: `projectUuid` sent to backend (resolved in controller)
- [x] Drawing detail page: UUID-based service calls replace mock API
- [ ] Correspondence form: still sends `parseInt(projectId)` — see 5.4
- [ ] User dialog: still sends `parseInt(orgId)` — see 5.4

### 5.4 Remaining: FK Reference UUID Migration (❌ PENDING)

> **Root Cause:** Backend Create/Update DTOs still accept **integer FK IDs** (e.g., `projectId`, `fromOrganizationId`), but the API **no longer returns integer IDs** in responses (stripped by `@Exclude()` + `instanceToPlain()` in `TransformInterceptor`). Frontend forms that use `parseInt()` on Select values break because the values are either UUID strings or `undefined`.

#### Pattern: Drawing Search (✅ FIXED — reference implementation)

- Backend DTO accepts `projectPublicId: string` instead of `projectId: number`
- Controller resolves: `projectService.findOneByUuid(dto.projectPublicId)` → `dto.projectId = project.id`
- Frontend sends UUID string directly (no `parseInt`)
- Frontend Type uses `publicId` only:
  ```typescript
  type ProjectOption = {
    publicId?: string;
    projectName?: string;
  };
  ```

#### Remaining Issues (Updated Naming Convention)

| File                                  | Field                                                 | Entity       | Issue                                                        |
| ------------------------------------- | ----------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `correspondences/form.tsx`            | `projectPublicId`                                     | Project      | Type uses `id` instead of `publicId`                         |
| `correspondences/form.tsx`            | `fromOrganizationPublicId`                            | Organization | Type uses `uuid/id` instead of `publicId`                    |
| `correspondences/form.tsx`            | `toOrganizationPublicId`                              | Organization | Type uses `uuid/id` instead of `publicId`                    |
| `admin/users/page.tsx`                | `primaryOrganizationPublicId` (filter)                | Organization | Type uses `id` instead of `publicId`                         |
| `admin/user-dialog.tsx`              | `primaryOrganizationPublicId`                         | Organization | Type uses `id` instead of `publicId`                         |
| `numbering/template-tester.tsx`      | `originatorOrganizationPublicId` / `recipientOrganizationPublicId` | Organization | Type uses `id` instead of `publicId`              |
| `rfas/page.tsx`                       | `projectPublicId` (URL param)                         | Project      | Type uses `id` instead of `publicId`                       |
| `rfas/form.tsx`                       | `projectPublicId`, `contractPublicId`, `toOrganizationPublicId` | Multiple | ✅ FIXED — Now uses `publicId` exclusively |

> **Fix Applied:** `rfas/form.tsx` standardized to use `publicId` only (2026-03-28)

#### Fix Strategy (same pattern as Drawing Search fix)

For each affected backend DTO:

1. Add `projectUuid?: string` / `organizationUuid?: string` field
2. Controller resolves UUID → INT id via respective service's `findOneByUuid()`
3. Frontend sends UUID string directly (remove `parseInt`)

**Estimated Effort:** M (2-3 days) — requires backend DTO changes for Correspondence, User, Numbering modules

---

## Phase 6: Testing & Verification

### 6.1 Unit Tests

- UUID generation produces valid UUIDv7
- UuidBaseEntity `@BeforeInsert()` auto-generates UUID when not provided
- ParseUuidPipe rejects invalid UUIDs
- MariaDB native UUID column stores and retrieves string format correctly

### 6.2 Integration Tests

- Entity creation auto-generates UUID
- API endpoints accept UUID parameters
- UUID lookup returns correct records
- Duplicate UUID detection (unique constraint)

### 6.3 Performance Verification

- Benchmark: UUID lookup via UNIQUE INDEX vs INT PK lookup
- Acceptable threshold: < 2x overhead on single-row lookups
- Verify B-tree ordering with time-sorted UUIDv7

---

## Implementation Order (Priority)

| Order | Task                                                          | Effort | Status                     |
| ----- | ------------------------------------------------------------- | ------ | -------------------------- |
| 1     | UuidBaseEntity (no transformer needed — MariaDB native UUID)  | S      | ✅ Done                    |

**Estimated Remaining Effort:** ~2-3 days for FK migration + ~2 days for tests

---

## Rollback Strategy

If issues arise:

1. **Schema:** UUID columns have `DEFAULT` — existing inserts still work without app changes
2. **API:** INT-based endpoints can be restored by reverting controller/service changes
3. **Data:** No data loss — UUID column is additive (no existing columns modified)
4. **Frontend:** Route parameter changes are reversible

---

## Notes

- **Seed files** do not need UUID values — the `DEFAULT UUID()` clause auto-generates UUIDs at INSERT time
- **Notifications table** uses a non-unique INDEX (not UNIQUE) for uuid because of its partitioned composite PK `(id, created_at)`
- **Workflow engine tables** (`workflow_instances`, `workflow_tasks`) already use `CHAR(36)` UUIDs — no changes needed
- **Shared-PK tables** (`rfas`, `rfa_revisions`, `transmittals`) inherit their parent's UUID via the correspondence relationship
