# Data Model: Unified Document CRUD Management

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## New Entities & Value Objects

### 1. DocumentActionStrategy (Interface — no DB table)

Type-Specific Strategy interface defining behavior per document type.

```typescript
interface DocumentActionStrategy {
  readonly documentType: 'correspondence' | 'rfa' | 'transmittal' | 'drawing' | 'circulation';
  readonly canCancel: boolean;
  readonly canHardDelete: boolean;
  readonly canMetadataPatch: boolean;
  readonly cancelLabel: string;       // i18n key
  readonly hardDeleteLabel: string;   // i18n key

  cancel(publicId: string, reason: string, user: AuthUser): Promise<ActionResult>;
  hardDelete(publicId: string, user: AuthUser): Promise<ActionResult>;
  metadataPatch(publicId: string, patch: MetadataPatchDto, user: AuthUser): Promise<ActionResult>;
  getCascadePolicy(): HardDeleteCascadePolicy;
}
```

### 2. SideEffectsResult (Value Object — no DB table)

```typescript
interface SideEffectsResult {
  searchReindexed: boolean;
  notificationsSent: number;
  workflowTerminated: boolean;
  circulationsClosed: number;
  vectorsDeleted: 'COMPLETED' | 'PENDING_RETRY' | 'SKIPPED';
  filesDeleted: number;
  failedSideEffects: string[];
}
```

### 3. ActionResult (Value Object — no DB table)

```typescript
interface ActionResult {
  success: boolean;
  publicId: string;
  action: 'CANCEL' | 'HARD_DELETE' | 'METADATA_PATCH';
  sideEffects: SideEffectsResult;
  auditId: string;
}
```

### 4. BulkOperationResult (Value Object — no DB table)

```typescript
interface BulkOperationResult {
  bulkId: string;           // UUIDv7
  action: 'BULK_CANCEL' | 'BULK_TAG' | 'BULK_EXPORT';
  total: number;
  succeeded: BulkItemResult[];
  failed: BulkItemFailure[];
  jobId: string;            // BullMQ job ID for progress polling
}

interface BulkItemResult {
  publicId: string;
  auditId: string;
}

interface BulkItemFailure {
  publicId: string;
  reason: string;
  errorCode: string;
}
```

### 5. BulkExportCsvSchema (Value Object — no DB table)

Default columns for metadata-only bulk export; `fields` array in request can select subset.

```typescript
const BULK_EXPORT_CSV_COLUMNS = [
  'documentNumber',
  'documentType',
  'subject',
  'status',
  'createdAt',
  'originator',
  'project',
  'tags',
  'remarks',
  'dueDate',
] as const;
```

### 6. DocumentModule (Backend Module — no DB table)

New NestJS cross-type module for shared document operations:

```typescript
// backend/src/modules/document/document.module.ts
// - registers DocumentController for /documents/bulk-tag and /documents/bulk-export
// - reuses per-type strategies via DocumentActionStrategy registry
```

### 7. MetadataPatchDto (Value Object — per type)

```typescript
interface MetadataPatchDto {
  expectedVersion: number;   // Optimistic Lock
  fields: MetadataPatchFields;
}

// Tier 1 (Always Editable)
interface Tier1Fields {
  subject?: string;
  remarks?: string;
  dueDate?: string;          // ISO 8601
  tagIds?: number[];
  ccRecipientOrgIds?: number[];
}

// Tier 2 (Status-Dependent — DRAFT/IN_REVIEW only)
interface Tier2Fields {
  body?: string;
  transmittalItemIds?: number[];      // Transmittal only
  circulationRoutingIds?: number[];   // Circulation only
  drawingVolumeId?: number;           // Drawings only
  drawingCategoryId?: number;         // Drawings only
}

// Tier 3 (Never Editable — Superadmin Force-Edit only)
interface Tier3Fields {
  documentNumber?: string;   // Superadmin only
  originatorOrgId?: number;  // Superadmin only
  projectPublicId?: string;  // Superadmin only
}
```

### 6. HardDeleteSnapshot (Value Object — stored in audit metadata)

```typescript
interface HardDeleteSnapshot {
  documentNumber: string;
  status: string;
  attachmentCount: number;
  vectorCount: number;
  projectPublicId: string;
  originatorOrgId: number;
  createdAt: string;         // ISO 8601
}
```

## Existing Entities — Modifications

### Correspondence Entity

| Field | Change | Notes |
|-------|--------|-------|
| `version` | Already has `@VersionColumn` | Used for Optimistic Lock on Metadata Patch |
| `status` | Already exists | Add `CANCELLED` to allowed values (already supported) |

### RFA Entity

| Field | Change | Notes |
|-------|--------|-------|
| `version` | Add `@VersionColumn` | For Optimistic Lock on Metadata Patch |
| `status` | Already exists | Add `CANCELLED` to allowed values |
| `deletedAt` | Already exists | Soft-delete support |

### Transmittal Entity

| Field | Change | Notes |
|-------|--------|-------|
| `version` | Add `@VersionColumn` | For Optimistic Lock |
| `status` | Add if not exists | New field for Cancel support (DRAFT → SUBMITTED → CANCELLED) |
| `cancelReason` | Add column | NVARCHAR(500), nullable |
| `cancelledAt` | Add column | DATETIME, nullable |
| `cancelledBy` | Add column | INT FK to users, nullable |

### Drawing Entities (Contract/Shop/Asbuilt)

| Field | Change | Notes |
|-------|--------|-------|
| `version` | Add `@VersionColumn` | For Optimistic Lock |
| `deletedAt` | Already exists | Soft-delete (used as "cancel" for Drawings) |
| `deleteReason` | Add column | NVARCHAR(500), nullable |

### Circulation Entity

| Field | Change | Notes |
|-------|--------|-------|
| `version` | Add `@VersionColumn` | For Optimistic Lock on routing edits |
| `forceCloseReason` | Already exists | Used by Force Close |

## New Permissions (seed-permissions.sql)

```sql
-- Metadata Patch Permissions
INSERT INTO permissions (code, description, category) VALUES
  ('correspondence.edit_metadata', 'แก้ไขข้อมูลกำกับ Correspondence', 'correspondence'),
  ('rfa.edit_metadata', 'แก้ไขข้อมูลกำกับ RFA', 'rfa'),
  ('transmittal.edit_metadata', 'แก้ไขข้อมูลกำกับ Transmittal', 'transmittal'),
  ('drawing.edit_metadata', 'แก้ไขข้อมูลกำกับ Drawing', 'drawing'),
  ('circulation.edit_routing', 'แก้ไขเส้นทาง Circulation', 'circulation');

-- Bulk Operation Permissions
INSERT INTO permissions (code, description, category) VALUES
  ('correspondence.bulk_cancel', 'ยกเลิก Correspondence เป็นชุด', 'correspondence'),
  ('rfa.bulk_cancel', 'ยกเลิก RFA เป็นชุด', 'rfa'),
  ('transmittal.bulk_cancel', 'ยกเลิก Transmittal เป็นชุด', 'transmittal'),
  ('drawing.bulk_delete', 'ลบ Drawing เป็นชุด', 'drawing'),
  ('document.bulk_export', 'ส่งออกเอกสารเป็นชุด', 'document'),
  ('document.bulk_tag', 'เพิ่มแท็กเอกสารเป็นชุด', 'document');

-- Maintenance Permissions
INSERT INTO permissions (code, description, category) VALUES
  ('system.numbering_override', 'แก้ไขเลขที่เอกสาร (Maintenance)', 'system'),
  ('system.orphan_cleanup', 'ล้างไฟล์ขยะ (Maintenance)', 'system'),
  ('system.vector_sync', 'ซิงค์เวกเตอร์ค้นหา (Maintenance)', 'system'),
  ('system.emergency_unlock', 'ปลดล็อกฉุกเฉิน (Maintenance)', 'system');
```

## Role-Permission Mapping Adjustments

```sql
-- DC role: add cancel + metadata + bulk_cancel (NOT hard_delete)
-- DC should NOT have correspondence.delete (that's Hard-Delete)
-- Verify and remove correspondence.delete from DC role if present

-- Superadmin role: add all new permissions + system.manage_all fallback
-- Superadmin already has system.manage_all which is hierarchy fallback

-- System Admin role: add maintenance permissions
-- System Admin should have system.numbering_override, system.orphan_cleanup,
-- system.vector_sync, system.emergency_unlock
```

## State Transitions

### Correspondence / RFA / Transmittal (Status-based)

```text
DRAFT ──submit──→ IN_REVIEW ──approve──→ APPROVED
  │                  │                     │
  │──cancel──→ CANCELLED ←──cancel──←──────┘
  │
  └──cancel──→ CANCELLED
```

### Drawings (Soft Delete — no status)

```text
ACTIVE (deletedAt = NULL) ──soft-delete──→ DELETED (deletedAt = timestamp)
                                              │
                                              └──hard-delete──→ (removed from DB)
```

### Circulation (Force Close)

```text
IN_PROGRESS ──force-close──→ FORCE_CLOSED
  │
  └──complete──→ COMPLETED
```

## Audit Trail Schema

### Audit Metadata JSON Structure

**Metadata Patch:**
```json
{
  "action": "METADATA_PATCH",
  "before": { "subject": "Old Subject", "tags": [1, 2] },
  "after": { "subject": "New Subject", "tags": [1, 2, 3] },
  "diff": [
    { "field": "subject", "old": "Old Subject", "new": "New Subject" },
    { "field": "tags", "old": [1, 2], "new": [1, 2, 3] }
  ]
}
```

**Hard-Delete Snapshot:**
```json
{
  "action": "HARD_DELETE",
  "hardDeleteSnapshot": {
    "documentNumber": "COR-2026-001",
    "status": "IN_REVIEW",
    "attachmentCount": 3,
    "vectorCount": 2,
    "projectPublicId": "019505a1-...",
    "originatorOrgId": 5,
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

**Bulk Operation:**
```json
{
  "action": "BULK_CANCEL",
  "bulkId": "019505a1-7c3e-7000-8000-abc123def456",
  "itemPublicId": "019505a2-...",
  "reason": "Bulk cancel reason"
}
```
