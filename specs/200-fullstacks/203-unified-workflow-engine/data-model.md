# Data Model: Unified Workflow Engine — Production Hardening

**Phase 1 Output** | Generated: 2026-05-02  
**Extends**: `specs/08-Tasks/ADR-021-workflow-context/data-model.md` (deltas 01–08 already applied)

---

## 1. Schema Deltas

### Delta 09 — `version_no` on `workflow_instances`

**File**: `specs/03-Data-and-Storage/deltas/09-add-version-no-to-workflow-instances.sql`

```sql
-- ============================================================
-- Delta 09: ADR-001 v1.1 — Optimistic Lock
-- เพิ่ม version_no ใน workflow_instances สำหรับ Optimistic Concurrency Control
-- ============================================================
-- ข้อควรระวัง: Existing rows จะได้ค่า DEFAULT 1 อัตโนมัติ — ไม่มี Data Loss
-- Rollback: ALTER TABLE workflow_instances DROP COLUMN version_no;

ALTER TABLE workflow_instances
  ADD COLUMN version_no INT NOT NULL DEFAULT 1
    COMMENT 'Optimistic lock counter — incremented on every successful transition (ADR-001 v1.1 FR-002)';

-- Index เพื่อรองรับ CAS check: WHERE id = ? AND version_no = ?
CREATE INDEX idx_wf_inst_version
  ON workflow_instances (id, version_no);
```

**Migration Notes (ADR-009):**
- Apply via MariaDB CLI or n8n delta workflow — ไม่มี TypeORM migration file
- Existing instances get `version_no = 1` — no disruption to active workflows
- Rollback: `ALTER TABLE workflow_instances DROP INDEX idx_wf_inst_version; ALTER TABLE workflow_instances DROP COLUMN version_no;`

---

### Delta 10 — `action_by_user_uuid` on `workflow_histories`

**File**: `specs/03-Data-and-Storage/deltas/10-add-action-by-user-uuid-to-workflow-histories.sql`

```sql
-- ============================================================
-- Delta 10: ADR-001 v1.1 / ADR-019 UUID Compliance
-- เพิ่ม action_by_user_uuid ใน workflow_histories
-- เพื่อ expose User identity ผ่าน API โดยไม่ต้องเปิดเผย INT PK (ADR-019)
-- ============================================================
-- ข้อควรระวัง: NULL สำหรับ Historical records ที่สร้างก่อน delta นี้ (เป็น Acceptable)
-- Rollback: ALTER TABLE workflow_histories DROP COLUMN action_by_user_uuid;

ALTER TABLE workflow_histories
  ADD COLUMN action_by_user_uuid VARCHAR(36) NULL
    COMMENT 'UUID ของ User ผู้ดำเนินการ — ใช้ใน API Response (ADR-019). INT FK action_by_user_id ยังคงอยู่สำหรับ Internal use';
```

**Migration Notes (ADR-009):**
- NULL สำหรับ historical records — acceptable; API consumers treat NULL as "system action" or "pre-migration"
- Populate on all new transitions from this delta forward

---

## 2. Backend Entity Changes

### 2.1 `workflow-instance.entity.ts` — Add `versionNo`

**File**: `backend/src/modules/workflow-engine/entities/workflow-instance.entity.ts`

```typescript
// เพิ่มหลัง updatedAt column
@Column({
  name: 'version_no',
  type: 'int',
  default: 1,
  comment: 'Optimistic lock — incremented on each successful transition (ADR-001 v1.1)',
})
versionNo!: number;
```

**Import to add**: No new imports needed.

---

### 2.2 `workflow-history.entity.ts` — Add `actionByUserUuid`

**File**: `backend/src/modules/workflow-engine/entities/workflow-history.entity.ts`

```typescript
// เพิ่มหลัง actionByUserId column
@Column({
  name: 'action_by_user_uuid',
  length: 36,
  nullable: true,
  comment: 'UUID ของ User ผู้ดำเนินการ — expose ใน API Response per ADR-019',
})
actionByUserUuid?: string;
```

---

### 2.3 `workflow-history-item.dto.ts` — Add `actorUuid`

**File**: `backend/src/modules/workflow-engine/dto/workflow-history-item.dto.ts`

```typescript
// เพิ่ม field ใน WorkflowHistoryItemDto
@ApiPropertyOptional({
  description: 'UUID ของ User ผู้ดำเนินการ (ADR-019)',
  example: '019505a1-7c3e-7000-8000-abc123def456',
})
actorUuid?: string;
```

---

## 3. `processTransition()` — Optimistic Lock Changes

### Updated signature

```typescript
async processTransition(
  instanceId: string,
  action: string,
  userId: number,
  userUuid: string,          // NEW: ADR-019 UUID for history record
  comment?: string,
  payload: Record<string, unknown> = {},
  attachmentPublicIds?: string[],
  clientVersionNo?: number,  // NEW: Optimistic lock — sent by client
)
```

### Fast-fail check (before Redlock)

```typescript
if (clientVersionNo !== undefined) {
  const current = await this.instanceRepo.findOne({
    where: { id: instanceId },
    select: ['id', 'versionNo'],
  });
  if (!current) throw new NotFoundException('Workflow Instance', instanceId);
  if (current.versionNo !== clientVersionNo) {
    throw new ConflictException(
      'WORKFLOW_VERSION_CONFLICT',
      `Expected version_no=${clientVersionNo}, actual=${current.versionNo}`,
      'เอกสารถูกอนุมัติโดยผู้อื่นแล้ว กรุณารีเฟรช',
      ['รีเฟรชหน้าแล้วลองใหม่']
    );
  }
}
```

### History creation — add `actionByUserUuid`

```typescript
const history = this.historyRepo.create({
  instanceId: instance.id,
  fromState,
  toState,
  action,
  actionByUserId: userId,
  actionByUserUuid: userUuid,  // NEW
  comment,
  metadata: { events: evaluation.events },
});
```

### Version increment (inside DB transaction, after history save)

```typescript
// CAS update — ถ้า version_no ถูกเปลี่ยนระหว่างนี้ (TOCTOU) จะไม่มีแถวถูก update
const result = await queryRunner.manager
  .createQueryBuilder()
  .update(WorkflowInstance)
  .set({ versionNo: () => 'version_no + 1' })
  .where('id = :id AND version_no = :expected', {
    id: instanceId,
    expected: instance.versionNo,
  })
  .execute();

if (result.affected === 0) {
  // TOCTOU: version changed under pessimistic lock (edge case — should not normally occur)
  throw new ConflictException(
    'WORKFLOW_VERSION_CONFLICT',
    'version_no changed between lock acquisition and update',
    'เกิด Conflict กรุณารีเฟรชและลองใหม่',
    ['รีเฟรชหน้า', 'ลองดำเนินการอีกครั้ง']
  );
}
```

---

## 4. `processTransition()` — Structured Observability Changes

### New metric injections in constructor

```typescript
@InjectMetric('workflow_transitions_total')
private readonly transitionsTotal: Counter<string>,

@InjectMetric('workflow_transition_duration_ms')
private readonly transitionDuration: Histogram<string>,
```

### Wrap in timer + log

```typescript
const startMs = Date.now();
let outcome: 'success' | 'conflict' | 'forbidden' | 'validation_error' | 'system_error' = 'system_error';
let workflowCode = 'unknown';

try {
  // ... existing processTransition logic ...
  workflowCode = instance.definition.workflow_code;
  outcome = 'success';
} catch (err) {
  if (err instanceof ConflictException) outcome = 'conflict';
  else if (err instanceof ForbiddenException) outcome = 'forbidden';
  else if (err instanceof WorkflowException) outcome = 'validation_error';
  throw err;
} finally {
  const durationMs = Date.now() - startMs;
  this.transitionDuration.labels({ workflow_code: workflowCode }).observe(durationMs);
  this.transitionsTotal.labels({ workflow_code: workflowCode, action, outcome }).inc();
  this.logger.log(JSON.stringify({
    instanceId, action, fromState: instance?.currentState,
    toState: outcome === 'success' ? toState : undefined,
    userUuid, durationMs, outcome, workflowCode,
  }));
}
```

### Module registration (in `workflow-engine.module.ts`)

```typescript
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

// Add to providers array:
makeCounterProvider({
  name: 'workflow_transitions_total',
  help: 'Total workflow transitions by code, action, and outcome',
  labelNames: ['workflow_code', 'action', 'outcome'],
}),
makeHistogramProvider({
  name: 'workflow_transition_duration_ms',
  help: 'Workflow transition duration in milliseconds',
  labelNames: ['workflow_code'],
  buckets: [50, 100, 250, 500, 1000, 2500, 5000],
}),
```

---

## 5. DSL Cache Changes (FR-007)

### Cache methods in `workflow-engine.service.ts`

```typescript
// ใน createDefinition() — หลัง save
await this.cacheManager.set(
  `wf:def:${saved.workflow_code}:${saved.version}`,
  saved,
  3600 * 1000  // 1 hour in ms (cache-manager v5 uses ms)
);

// ใน update() — ก่อน save (ถ้า DSL เปลี่ยน)
await this.cacheManager.del(`wf:def:${definition.workflow_code}:${definition.version}`);

// ใน activate/deactivate — invalidate active pointer
await this.redis.del(`wf:def:${definition.workflow_code}:active`);
if (dto.is_active === true) {
  await this.cacheManager.set(
    `wf:def:${definition.workflow_code}:active`,
    saved,
    3600 * 1000
  );
}
```

---

## 6. BullMQ DLQ + n8n Webhook Changes (FR-005, FR-006)

### `workflow-event.service.ts` additions

```typescript
// ใน WorkflowEventProcessor:

@OnWorkerEvent('failed')
async onJobFailed(job: Job, error: Error): Promise<void> {
  // ตรวจสอบว่าหมด retry แล้วหรือยัง
  if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 3)) {
    // ส่งไปยัง DLQ
    await this.failedQueue.add('dead-letter', {
      originalJobId: job.id,
      queue: 'workflow-events',
      data: job.data,
      failedAt: new Date().toISOString(),
      error: error.message,
    });

    // แจ้ง Ops ผ่าน n8n webhook (ถ้าตั้งค่าไว้)
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'workflow_event_failed',
            jobId: job.id,
            workflowCode: job.data?.workflowCode,
            instanceId: job.data?.instanceId,
            error: error.message,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (webhookErr) {
        // Warning เท่านั้น — ไม่ throw เพื่อไม่ให้กระทบ DLQ add
        this.logger.warn(`n8n webhook failed: ${(webhookErr as Error).message}`);
      }
    } else {
      this.logger.warn('N8N_WEBHOOK_URL not configured — DLQ job created without ops notification');
    }
  }
}
```

### Worker configuration (verify/update in `workflow-engine.module.ts`)

```typescript
WorkerHost({
  connection: { ... },
  concurrency: 5,
  limiter: { max: 50, duration: 60000 },
}),
// Job default options
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 500 },
  removeOnComplete: { age: 86400 },
  removeOnFail: false,  // Keep in failed state for Bull Board visibility
}
```

---

## 7. Updated Entity Relationship Diagram

```
workflow_definitions
  workflow_code + version (unique)
  is_active: BOOLEAN
       │ 1
       │
       ▼ N
workflow_instances
  version_no: INT DEFAULT 1       ← NEW (Delta 09)
  current_state: VARCHAR(50)
  context: JSON
  contract_id: INT NULL
       │ 1
       │
       ▼ N
workflow_histories
  action_by_user_id: INT NULL     ← existing (internal FK)
  action_by_user_uuid: VARCHAR(36) ← NEW (Delta 10, ADR-019)
  from_state / to_state / action
  metadata: JSON
       │ 1
       │
       ▼ N
attachments
  workflow_history_id: CHAR(36) NULL  ← Delta 04 (already applied)
  uuid: VARCHAR(36)                   ← publicId (ADR-019)
```

---

## 8. Index Strategy (updated)

| Table | Index | Columns | Purpose | Status |
|-------|-------|---------|---------|--------|
| `workflow_instances` | `idx_wf_inst_version` | `(id, version_no)` | Optimistic lock CAS check | **NEW** |
| `workflow_instances` | `idx_wf_inst_entity` | `(entity_type, entity_id)` | Polymorphic lookup | Existing |
| `workflow_histories` | `idx_wf_hist_instance` | `(instance_id)` | History per instance | Existing |
| `attachments` | `idx_att_wfhist_created` | `(workflow_history_id, created_at)` | Step attachments | Delta 04 |
