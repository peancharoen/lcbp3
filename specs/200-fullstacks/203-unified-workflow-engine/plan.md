# Implementation Plan: Unified Workflow Engine — Production Hardening & Integrated Context

**Branch**: `003-unified-workflow-engine` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-unified-workflow-engine/spec.md`

---

## Summary

The Workflow Engine backend infrastructure is substantially implemented (service, entities, guards, DSL, Redlock, Prometheus metrics). This plan closes the remaining production-hardening gaps from ADR-001 v1.1 (optimistic lock, user UUID in history, CASL-mapped DSL roles, per-transition metrics, DSL Redis cache, DLQ + n8n webhook) and completes ADR-021 (step-specific attachment data-wiring in all 4 modules, file preview modal, Admin DSL editor UI).

Clarification decisions from `spec.md`:
- **Q1**: DSL `require.role` → CASL ability check (FR-002a)
- **Q2**: Observability = structured log + counter + histogram (FR-022, FR-023)
- **Q3**: File rollback on DB failure = move back to temp, 24h TTL (FR-019)
- **Q4**: Admin DSL editor UI is in scope (FR-024, FR-025)
- **Q5**: All 4 modules need banner gap-filling (FR-011)

---

## Technical Context

**Language/Version**: TypeScript 5.4, Node.js 20 LTS  
**Primary Dependencies**: NestJS 10, TypeORM 0.3, BullMQ 5, `@willsoto/nestjs-prometheus`, `json-logic-js`, `redlock`, `ioredis`  
**Frontend**: Next.js 14 (App Router), TanStack Query v5, React Hook Form + Zod, shadcn/ui  
**Storage**: MariaDB 10.11, Redis 7, StorageService (Two-Phase Upload per ADR-016)  
**Testing**: Jest + `@nestjs/testing` (backend), Vitest (frontend)  
**Target Platform**: QNAP NAS Docker Compose (backend), Next.js SSR (frontend)  
**Performance Goals**: Transition P95 < 1s (no upload); upload+transition P95 < 5s; cache invalidation < 1s across all instances  
**Constraints**: ADR-009 (no TypeORM migrations), ADR-019 (UUID strings, no parseInt), ADR-016 (Two-Phase Upload), ADR-008 (BullMQ async)  
**Scale/Scope**: 4 document modules × ~50 active workflows concurrently; up to 20 history records per instance

---

## Constitution Check

_GATE: Must pass before Phase 0. Re-checked after Phase 1 design._

| Gate | Rule | Status | Notes |
|------|------|--------|-------|
| ADR-019 UUID | No `parseInt` on UUIDs; expose `publicId` strings only | ✅ PASS | `WorkflowInstance.id` and `WorkflowHistory.id` are UUID PKs (native CHAR(36)); `action_by_user_uuid` addition follows pattern |
| ADR-009 Schema | No TypeORM migrations; edit SQL directly | ✅ PASS | Two new delta files planned (delta-09, delta-10) |
| ADR-016 Security | Two-Phase upload; ClamAV; whitelist | ✅ PASS | Already implemented in `processTransition()`; file preview uses existing attachment endpoint |
| ADR-008 BullMQ | Async notifications; no inline dispatch | ✅ PASS | `WorkflowEventService` dispatches to `workflow-events` queue; DLQ is the gap |
| ADR-007 Errors | Layered exception hierarchy | ✅ PASS | `WorkflowException`, `ConflictException`, `ServiceUnavailableException` already in use |
| ADR-002 Numbering | Redlock for document numbering | ✅ N/A | Workflow engine does not generate document numbers |
| ADR-018/020 AI | No AI direct DB access | ✅ N/A | No AI integration in this feature |
| FR-002 Optimistic Lock | `version_no` column on `workflow_instances` | ⚠️ GAP | Column missing — delta-09 required |
| FR-003 User UUID | `action_by_user_uuid` on `workflow_histories` | ⚠️ GAP | Column missing — delta-10 required |

**Post-gate verdict**: PASS with two schema deltas required before implementation begins.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-unified-workflow-engine/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── contracts/           ← Phase 1 output
    ├── workflow-transition.yaml
    └── workflow-definitions.yaml
```

### Source Code Layout

```text
backend/src/modules/workflow-engine/
├── entities/
│   ├── workflow-instance.entity.ts      ← ADD versionNo column
│   └── workflow-history.entity.ts       ← ADD actionByUserUuid column
├── guards/
│   └── workflow-transition.guard.ts     ← ADD DSL require.role → CASL mapping (FR-002a)
├── dto/
│   └── workflow-history-item.dto.ts     ← ADD actorUuid field
├── workflow-engine.service.ts           ← ADD version_no check, structured log, metrics, cache invalidation
├── workflow-event.service.ts            ← ADD DLQ processor + n8n webhook (FR-005/006)
└── workflow-engine.module.ts            ← Register new metrics providers

specs/03-Data-and-Storage/deltas/
├── 09-add-version-no-to-workflow-instances.sql    ← NEW
└── 10-add-action-by-user-uuid-to-workflow-histories.sql  ← NEW

frontend/components/workflow/
├── integrated-banner.tsx                ← GAP-FILL: step-attachment upload zone
├── workflow-lifecycle.tsx               ← GAP-FILL: history items with attachment list
└── file-preview-modal.tsx               ← NEW component

frontend/app/(admin)/admin/workflows/
└── definitions/
    ├── page.tsx                         ← NEW: DSL list + activate/deactivate
    └── [id]/
        └── page.tsx                     ← NEW: DSL JSON editor + inline validation

frontend/app/(admin)/admin/doc-control/
├── rfa/[uuid]/page.tsx                  ← GAP-FILL: availableActions, step-attach
├── transmittals/[uuid]/page.tsx         ← GAP-FILL: step-attach upload zone
├── circulation/[uuid]/page.tsx          ← GAP-FILL: step-attach upload zone
└── correspondence/[uuid]/page.tsx       ← GAP-FILL + new IntegratedBanner wiring
```

---

## Implementation Phases

### Phase B1: Schema Deltas (prerequisite)

Apply before any code changes.

| Delta | File | Change |
|-------|------|--------|
| 09 | `09-add-version-no-to-workflow-instances.sql` | `ALTER TABLE workflow_instances ADD COLUMN version_no INT NOT NULL DEFAULT 1` |
| 10 | `10-add-action-by-user-uuid-to-workflow-histories.sql` | `ALTER TABLE workflow_histories ADD COLUMN action_by_user_uuid VARCHAR(36) NULL` |

### Phase B2: Entity & DTO Updates

| Task | File | Change |
|------|------|--------|
| B2-1 | `workflow-instance.entity.ts` | Add `@Column() versionNo: number` with `@Version()` decorator |
| B2-2 | `workflow-history.entity.ts` | Add `@Column() actionByUserUuid?: string` |
| B2-3 | `workflow-history-item.dto.ts` | Add `actorUuid: string` field (exposed in API per ADR-019) |

### Phase B3: Optimistic Lock in `processTransition()` (FR-002)

In `workflow-engine.service.ts`:
1. Accept `clientVersionNo?: number` parameter in `processTransition()`
2. If provided: compare against `instance.versionNo` BEFORE Redlock acquisition → throw `ConflictException` (HTTP 409) if mismatch
3. After DB transaction commit: increment `instance.versionNo + 1` via `UPDATE workflow_instances SET version_no = version_no + 1 WHERE id = :id AND version_no = :expected`
4. No separate pessimistic lock change needed — keep both as defense-in-depth

### Phase B4: CASL Role Mapping in Guard (FR-002a)

In `workflow-transition.guard.ts`:
1. After Level 1 (Superadmin) check, extract DSL `require.role` from the current step config
2. Map each DSL role string to a CASL ability string via `DSL_ROLE_TO_CASL` config map
3. Check `userPermissions.includes(mappedAbility)` for any match → pass
4. Fall through to existing Level 3 (assignedUserId) check for `"AssignedHandler"` role

```typescript
const DSL_ROLE_TO_CASL: Record<string, string> = {
  'Superadmin':      'system.manage_all',
  'OrgAdmin':        'organization.manage_users',
  'ContractMember':  'contract.view',
  'AssignedHandler': '__assigned__',   // resolved by existing Level 3 check
};
```

### Phase B5: Structured Observability (FR-022, FR-023)

In `workflow-engine.service.ts`:
1. Inject two new metrics via `@InjectMetric()`:
   - `workflow_transitions_total` (Counter: `workflow_code`, `action`, `outcome`)
   - `workflow_transition_duration_ms` (Histogram: `workflow_code`)
2. Wrap `processTransition()` in a `startTimer` → `observe(duration)` block
3. Emit structured log on every outcome:
   ```typescript
   this.logger.log(JSON.stringify({
     instanceId, action, fromState, toState, userUuid,
     durationMs, outcome, workflowCode
   }));
   ```
4. Register providers in `workflow-engine.module.ts`

### Phase B6: DSL Redis Cache Invalidation (FR-007)

In `workflow-engine.service.ts`:
1. In `createDefinition()`: after save, call `cacheManager.set('wf:def:${code}:${version}', entity, 3600)`
2. In `update()`: call `cacheManager.del('wf:def:${code}:${oldVersion}')` before save
3. In `getDefinitionById()` / cached lookup: read-through with `cacheManager.get()` → fallback to DB
4. On `is_active` toggle: invalidate ALL `wf:def:{code}:*` keys (use `redis.keys()` + `redis.del()` pattern)

### Phase B7: BullMQ DLQ + n8n Webhook (FR-005, FR-006)

In `workflow-event.service.ts`:
1. Add `workflow-events-failed` queue registration
2. Add `@OnWorkerEvent('failed')` handler in the processor class
3. On `attempts === maxAttempts`: POST to `process.env.N8N_WEBHOOK_URL` with job payload (never hardcoded)
4. Verify existing `workflow-events` worker has `concurrency: 5, attempts: 3, backoff: { type: 'exponential', delay: 500 }`

### Phase B8: File Rollback on Transaction Failure (FR-019)

In `workflow-engine.service.ts` `processTransition()`:
1. After file linkage step inside transaction, if `queryRunner.commitTransaction()` throws:
   - Call `storageService.moveToTemp(attachmentPublicIds)` in the `catch` block
   - Log the rollback with attachment IDs for audit
2. The 24h TTL on temp files is handled by existing `FileCleanupService` cron

### Phase F1: File Preview Modal (FR-020)

New component: `frontend/components/workflow/file-preview-modal.tsx`
- Props: `attachment: WorkflowAttachmentSummary | null`, `onClose: () => void`
- Renders PDF via `<iframe src="/api/files/{publicId}/preview" />` for PDFs
- Renders `<img>` for image MIME types
- Falls back to download link for unsupported types
- Uses shadcn/ui `Dialog` component

### Phase F2: Step-Attachment Upload Zone (FR-014–FR-019)

In `integrated-banner.tsx`:
1. Show upload zone only when `currentState ∈ {PENDING_REVIEW, PENDING_APPROVAL}` AND user is assigned handler/org-admin/superadmin
2. Upload zone calls existing Two-Phase upload endpoint, then appends `publicId` to pending list
3. On action button click, pass `attachmentPublicIds` array to `use-workflow-action.ts` hook
4. On success: invalidate TanStack Query cache for document + history

In `workflow-lifecycle.tsx`:
1. For each history item, render `attachments[]` as clickable file chips
2. On click: open `FilePreviewModal`

### Phase F3: Module Banner Gap-Fill (FR-011, all 4 modules)

For each detail page (`rfa`, `transmittals`, `circulation`, `correspondence`):
1. Ensure service `findOneByUuid()` exposes: `workflowInstanceId`, `workflowState`, `availableActions`, `workflowPriority`
2. Pass live values to `<IntegratedBanner>` and `<WorkflowLifecycle>`
3. Add step-attachment upload zone via Phase F2 components
4. Verify `WorkflowHistoryItemDto` includes `attachments[]` in the history endpoint

Correspondence is the only module requiring new backend wiring (Transmittal + Circulation already done per v1.8.7; RFA has partial wiring — needs `availableActions` + step-attach).

### Phase F4: Admin DSL Editor UI (FR-024, FR-025)

New pages under `frontend/app/(admin)/admin/workflows/definitions/`:

**List page** (`page.tsx`):
- Table of all workflow definitions with columns: `workflow_code`, `version`, `is_active`, actions (Edit / Activate / Deactivate)
- Uses TanStack Query `useWorkflowDefinitions()` hook
- Activate/Deactivate via `PATCH /workflow-engine/definitions/:id` with `{ is_active: true/false }`

**Editor page** (`[id]/page.tsx`):
- Load definition via `useWorkflowDefinition(id)`
- JSON editor (Monaco Editor or `@uiw/react-codemirror` in JSON mode)
- Inline validation: call `POST /workflow-engine/definitions/validate` with DSL JSON → display errors inline
- Save button disabled when validation errors present (FR-025)
- Form managed with React Hook Form + Zod (for wrapper metadata fields)

---

## Complexity Tracking

No constitution violations requiring justification.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `version_no` delta on live DB with existing instances | Medium | Delta sets `DEFAULT 1`; existing rows auto-initialize; no data loss |
| `action_by_user_uuid` delta — NULL for historical records | Low | Column is NULLABLE; historical records remain valid |
| DSL role mapping gaps (unknown role strings) | Medium | `DSL_ROLE_TO_CASL` unknown keys default to `__assigned__` check — fail-safe |
| Monaco Editor bundle size (~2MB) | Low | Lazy-loaded only on Admin DSL editor page; no impact to user-facing pages |
| n8n webhook URL not configured in some environments | Medium | Guard with `if (!N8N_WEBHOOK_URL)` → warn log, don't throw; ops can configure later |

---

## Test Plan

| Area | Tests Required | Target |
|------|---------------|--------|
| `WorkflowEngineService.processTransition` | Concurrent optimistic lock (409), version increment, structured log emission | Unit (Jest) |
| `WorkflowTransitionGuard` | DSL role → CASL mapping for each level | Unit (Jest) |
| `WorkflowEventService` DLQ | Failed job triggers n8n webhook | Unit (Jest + mock) |
| Transition metrics | Counter/histogram incremented on success + failure | Unit (Jest) |
| DSL cache invalidation | Activate triggers cache del | Integration (Jest) |
| File rollback (FR-019) | DB failure → `moveToTemp()` called | Unit (Jest + mock) |
| `FilePreviewModal` | Renders PDF/image/fallback correctly | Frontend (Vitest) |
| Admin DSL editor | Validation errors shown inline; save blocked | Frontend (Vitest) |
| Module gap-fill E2E | Each module detail page renders live `availableActions` | Manual / Playwright |
