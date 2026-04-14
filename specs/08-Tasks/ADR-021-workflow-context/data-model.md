# Data Model: ADR-021 Integrated Workflow Context & Step-specific Attachments

**Phase 1 Output** | Generated: 2026-04-12

---

## 1. SQL Delta

**File:** `specs/03-Data-and-Storage/deltas/04-add-workflow-history-id-to-attachments.sql`

```sql
-- ============================================================
-- Delta 04: ADR-021 — Step-specific Attachments
-- เพิ่ม FK workflow_history_id ใน attachments table
-- ============================================================
-- ข้อควรระวัง: ค่า NULL = ไฟล์แนบหลัก (Main Document)
--              ค่าไม่ NULL = ไฟล์ประจำ Workflow Step นั้น

ALTER TABLE attachments
  ADD COLUMN workflow_history_id CHAR(36) NULL
    COMMENT 'FK to workflow_histories.id สำหรับไฟล์แนบประจำ Step (ADR-021). NULL = ไฟล์แนบหลัก',
  ADD CONSTRAINT fk_attachments_workflow_history
    FOREIGN KEY (workflow_history_id)
    REFERENCES workflow_histories (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Index สำหรับ optimize การดึงไฟล์แนบตาม Step + เรียงตามวันที่
CREATE INDEX idx_att_wfhist_created
  ON attachments (workflow_history_id, created_at);
```

**Migration Notes (ADR-009):**
- Apply via `MariaDB CLI` หรือผ่าน n8n delta workflow
- ไม่มี TypeORM migration file — ห้ามสร้าง (ADR-009)
- Rollback: `ALTER TABLE attachments DROP FOREIGN KEY fk_attachments_workflow_history; ALTER TABLE attachments DROP COLUMN workflow_history_id;`

---

## 2. Backend Entity Changes

### 2.1 `attachment.entity.ts` — Add `workflowHistoryId`

**Current state (existing columns):**

```@/e:/np-dms/lcbp3/backend/src/common/file-storage/entities/attachment.entity.ts:43-58```

**Required additions:**

```typescript
// เพิ่มหลัง referenceDate column
@Column({ name: 'workflow_history_id', length: 36, nullable: true })
workflowHistoryId?: string;

// Lazy relation — ไม่ include ใน default query เพื่อป้องกัน N+1
@ManyToOne(
  () => WorkflowHistory,
  (history: WorkflowHistory) => history.attachments,
  { nullable: true, onDelete: 'SET NULL', lazy: true }
)
@JoinColumn({ name: 'workflow_history_id' })
workflowHistory?: Promise<WorkflowHistory>;
```

**Import to add:**
```typescript
import { WorkflowHistory } from '../../../modules/workflow-engine/entities/workflow-history.entity';
```

---

### 2.2 `workflow-history.entity.ts` — Add `attachments` relation

**Current state:**

```@/e:/np-dms/lcbp3/backend/src/modules/workflow-engine/entities/workflow-history.entity.ts:18-61```

**Required additions:**

```typescript
// เพิ่ม import
import { OneToMany } from 'typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';

// เพิ่มใน Class (หลัง createdAt)
// Lazy relation — โหลดเฉพาะเมื่อต้องการ (ป้องกัน N+1 ใน History list queries)
@OneToMany(
  () => Attachment,
  (attachment: Attachment) => attachment.workflowHistory,
  { lazy: true }
)
attachments?: Promise<Attachment[]>;
```

---

## 3. DTO Changes

### 3.1 `workflow-transition.dto.ts` — Add `attachmentPublicIds`

**Extended DTO:**

```typescript
// เพิ่ม imports
import { IsArray, IsUUID, ArrayMaxSize } from 'class-validator';

// เพิ่ม field ใน WorkflowTransitionDto
@ApiPropertyOptional({
  description: 'รายการ publicId ของไฟล์แนบ (ต้องอัปโหลดผ่าน Two-Phase ก่อน — ADR-016)',
  example: ['019505a1-7c3e-7000-8000-abc123def456'],
  type: [String],
})
@IsArray()
@IsUUID('all', { each: true })
@ArrayMaxSize(20)  // ป้องกัน payload ขนาดใหญ่เกิน (controlled by infra, this is soft guard)
@IsOptional()
attachmentPublicIds?: string[];
```

---

## 4. New Types

### 4.1 Backend — `WorkflowHistoryResponseDto`

**File:** `backend/src/modules/workflow-engine/dto/workflow-history-response.dto.ts` (NEW)

```typescript
export class AttachmentSummaryDto {
  publicId!: string;           // UUIDv7 (ADR-019)
  originalFilename!: string;
  mimeType!: string;
  fileSize!: number;
  createdAt!: Date;
}

export class WorkflowHistoryItemDto {
  id!: string;                 // UUID — เป็น PK โดยตรง (ไม่ใช่ UuidBaseEntity)
  fromState!: string;
  toState!: string;
  action!: string;
  actionByUserId?: number;
  comment?: string;
  createdAt!: Date;
  attachments!: AttachmentSummaryDto[];  // ไฟล์แนบประจำ Step นี้
}
```

---

## 5. Frontend Type Changes

### 5.1 `frontend/types/workflow.ts` — Add `WorkflowHistoryItem`

**Addition to existing file:**

```typescript
// ไฟล์แนบสรุปสำหรับแสดงใน Workflow Timeline
export interface WorkflowAttachmentSummary {
  publicId: string;           // ADR-019: ใช้ publicId เท่านั้น
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

// ประวัติ 1 ขั้นตอนใน Workflow Timeline
export interface WorkflowHistoryItem {
  id: string;                 // UUID — history record ID
  fromState: string;
  toState: string;
  action: WorkflowAction;
  actorName?: string;         // ชื่อผู้ดำเนินการ (populated via join)
  comment?: string;
  createdAt: string;
  attachments: WorkflowAttachmentSummary[];
  isCurrent?: boolean;        // computed by frontend
}

// Priority Enum สำหรับ Integrated Banner
export enum WorkflowPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}
```

### 5.2 `frontend/types/dto/workflow-engine/workflow-engine.dto.ts` — Add transition DTO

**Addition:**

```typescript
// Extended Transition DTO รองรับ Step-specific Attachments (ADR-021)
export interface WorkflowTransitionWithAttachmentsDto {
  action: string;
  comment?: string;
  payload?: Record<string, unknown>;
  attachmentPublicIds?: string[];    // pre-uploaded UUIDv7 list
}
```

---

## 6. State Transition with Attachment Flow

```
[User reviews document]
     │
     ▼
[Upload files via POST /files/upload (Two-Phase)]
  → ClamAV scan (auto)
  → Returns: { publicId, tempId, ... }[]
     │
     ▼
[User clicks Approve/Reject/Return]
  → use-workflow-action hook:
      1. Generates Idempotency-Key (UUIDv7)
      2. POST /workflow-engine/instances/:id/transition
         Header: Idempotency-Key
         Body: { action, comment, attachmentPublicIds: [uuid1, uuid2] }
     │
     ▼
[WorkflowTransitionGuard] — RBAC check (4-Level)
     │ pass
     ▼
[WorkflowEngineService.processTransition()]
  → Check Redis idempotency key (return cached if duplicate)
  → Acquire Redis Redlock on instanceId
  → Begin DB Transaction:
      1. Lock WorkflowInstance (pessimistic_write)
      2. Evaluate DSL transition
      3. Update WorkflowInstance.currentState
      4. Create WorkflowHistory record
      5. Resolve attachmentPublicIds → internal IDs
      6. UPDATE attachments SET workflow_history_id = :historyId
         WHERE uuid IN (:publicIds) AND is_temporary = false
      7. Commit Transaction
  → Release Redlock
  → Dispatch BullMQ events (notification, audit)
  → Invalidate Redis cache key wf:history:{instanceId}
  → Store idempotency response in Redis (TTL 24h)
     │
     ▼
[Response: { success, nextState, historyId, isCompleted }]
     │
     ▼
[Frontend: invalidate TanStack Query cache → reload document + timeline]
```

---

## 7. Entity Relationship Diagram

```
workflow_definitions
       │ 1
       │ has many
       ▼ N
workflow_instances ──────────────── documents (RFA/Corr/etc)
       │ 1                                 (entityType + entityId)
       │ has many
       ▼ N
workflow_histories ◄─────────────────────────────┐
       │ id: CHAR(36) UUID                        │
       │                                          │
       │ ◄── attachments.workflow_history_id (FK, nullable)
       │
attachments
  id: INT (internal, @Exclude)
  uuid: UUID (publicId — ADR-019)
  workflow_history_id: CHAR(36) NULL ← NEW (ADR-021)
```

---

## 8. Index Strategy

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `attachments` | `idx_att_wfhist_created` (NEW) | `(workflow_history_id, created_at)` | Fetch step attachments sorted by date |
| `workflow_histories` | `idx_wf_hist_instance` (existing) | `(instance_id)` | Fetch all steps for a workflow instance |
| `workflow_histories` | `idx_wf_hist_user` (existing) | `(action_by_user_id)` | Audit queries per user |

**No additional indexes required** — the composite `(workflow_history_id, created_at)` covers the primary access pattern.
