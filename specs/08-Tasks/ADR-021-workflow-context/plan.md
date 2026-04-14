# Implementation Plan: ADR-021 Integrated Workflow Context & Step-specific Attachments

**Branch**: `feat/adr-021-integrated-workflow-context` | **Date**: 2026-04-12 | **ADR**: [ADR-021](../../06-Decision-Records/ADR-021-integrated-workflow-context.md%20.md)
**Input**: Feature specification from `specs/06-Decision-Records/ADR-021-integrated-workflow-context.md .md`

---

## Summary

ปรับปรุง Workflow Engine ให้รองรับ (1) **Integrated Banner** ที่ยุบรวม Metadata + Status + Actions ไว้ด้วยกัน (2) **Vertical Timeline Lifecycle** พร้อม Active Step Highlighting และ (3) **Step-specific Attachments** ที่เชื่อมโยงไฟล์แนบกับ `workflow_history` ของแต่ละขั้นตอนโดยตรง

แนวทางเทคนิค: ขยาย `workflow_histories` ด้วย FK ใน `attachments` (Nullable) + ขยาย `WorkflowTransitionDto` รับ `attachmentPublicIds` (pre-uploaded UUIDv7 list) + สร้าง Frontend components ใหม่ 4 ชิ้น

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20+
**Primary Dependencies**:
- Backend: NestJS 10, TypeORM 0.3, MariaDB 10.6+, Redis (Redlock), BullMQ
- Frontend: Next.js 14 (App Router), TailwindCSS 3.4, shadcn/ui, TanStack Query v5, React Hook Form + Zod
**Storage**: MariaDB (schema via SQL delta — ADR-009), MinIO / Local FS via `StorageService`
**Testing**: Jest (backend unit + e2e), Vitest (frontend)
**Target Platform**: QNAP Container Station (Docker), Browser (Chrome/Edge latest)
**Project Type**: Web application (backend/ + frontend/ monorepo)
**Performance Goals**: Workflow history + attachment join query < 200ms p95 (mitigated by Redis Cache TTL 1h)
**Constraints**: No TypeORM migrations (ADR-009); UUID via `publicId` only (ADR-019); ClamAV scan mandatory (ADR-016); BullMQ for all async jobs (ADR-008)
**Scale/Scope**: ~50 concurrent users, documents in hundreds per project

---

## Constitution Check

_GATE: Checked against `.windsurfrules` before Phase 0. Re-verified after Phase 1._

| Gate | Status | Notes |
|------|--------|-------|
| **🔴 UUID Pattern (ADR-019)** | ✅ PASS | All attachment references via `publicId` (UUIDv7 string). `workflow_history_id` FK value is CHAR(36) UUID from `workflow_histories.id`. No `parseInt` usage. |
| **🔴 Schema via SQL Delta (ADR-009)** | ✅ PASS | Delta file `04-add-workflow-history-id-to-attachments.sql` — no TypeORM migration |
| **🔴 Two-Phase Upload (ADR-016)** | ✅ PASS | Files uploaded via existing Two-Phase endpoint first; `publicId`s referenced in transition DTO |
| **🔴 ClamAV Scan (ADR-016)** | ✅ PASS | ClamAV scan runs during Phase 1 of file upload (before transition) |
| **🔴 CASL Guard (ADR-016)** | ✅ PASS | New `WorkflowTransitionGuard` implements 4-Level RBAC |
| **🔴 Idempotency-Key (Security Rule #1)** | ✅ PASS | `POST /instances/:id/transition` validates `Idempotency-Key` header |
| **🔴 BullMQ Async (ADR-008)** | ✅ PASS | Notifications dispatched via `WorkflowEventService` (existing BullMQ pattern) |
| **🔴 No `any` types** | ✅ PASS | All new types fully typed — see data-model.md |
| **🟡 Thin Controller** | ✅ PASS | Controller delegates to Service; Guard handles RBAC |
| **🟡 Test Coverage 80% business logic** | ⚠️ REQUIRED | See testing plan in Phase 3 |
| **🔴 Redis Redlock (ADR-002)** | ✅ PASS | Redlock applied to `instanceId` during `processTransition()` — existing pattern extended |

---

## Project Structure

### Documentation (this feature)

```text
specs/08-Tasks/ADR-021-workflow-context/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── contracts/
    ├── workflow-transition.yaml     ← extended transition API contract
    └── workflow-history-list.yaml   ← attachment query API contract
```

### Source Code (impacted files)

```text
# 🔴 Backend — DB & Entities
specs/03-Data-and-Storage/deltas/
└── 04-add-workflow-history-id-to-attachments.sql   [NEW]

backend/src/common/file-storage/entities/
└── attachment.entity.ts                             [MODIFY — add workflowHistoryId + relation]

backend/src/modules/workflow-engine/entities/
└── workflow-history.entity.ts                       [MODIFY — add OneToMany attachments]

# 🔴 Backend — API & Guards
backend/src/modules/workflow-engine/dto/
└── workflow-transition.dto.ts                       [MODIFY — add attachmentPublicIds]

backend/src/modules/workflow-engine/guards/
└── workflow-transition.guard.ts                     [NEW — 4-Level RBAC]

backend/src/modules/workflow-engine/
├── workflow-engine.service.ts                       [MODIFY — extend processTransition()]
├── workflow-engine.controller.ts                    [MODIFY — add idempotency header, guard]
└── workflow-engine.module.ts                        [MODIFY — register guard]

# 🟡 Frontend — Types
frontend/types/
└── workflow.ts                                      [MODIFY — add attachments to WorkflowHistoryStep]

frontend/types/dto/workflow-engine/
└── workflow-engine.dto.ts                           [MODIFY — add WorkflowTransitionWithAttachmentsDto]

# 🟡 Frontend — New Components
frontend/components/workflow/
├── integrated-banner.tsx                            [NEW — Status + Metadata + Action bar]
└── workflow-lifecycle.tsx                           [NEW — Vertical timeline with Indigo active step]

frontend/components/common/
└── file-preview-modal.tsx                           [NEW — PDF/Image inline preview]

# 🟡 Frontend — New Hook
frontend/hooks/
└── use-workflow-action.ts                           [NEW — upload + transition orchestration]

# 🟡 Frontend — Page Refactors (use new components)
frontend/app/(dashboard)/rfas/[uuid]/page.tsx        [MODIFY — integrate IntegratedBanner + WorkflowLifecycle]
frontend/app/(dashboard)/correspondences/[uuid]/page.tsx [MODIFY — same]
frontend/app/(dashboard)/transmittals/[uuid]/page.tsx    [MODIFY — same, if detail page exists]
frontend/app/(dashboard)/circulation/[uuid]/page.tsx     [MODIFY — same, if detail page exists]
```

---

## Complexity Tracking

_No constitution violations. Architecture is additive (Nullable FK, extended DTO, new components)._

---

## Phase 0: Research Findings

→ See `research.md` for full details. Summary:

| Unknown | Decision | Rationale |
|---------|----------|-----------|
| File attachment strategy during transition | **Upload-Then-Reference** (not multipart) | Consistent with ADR-016 Two-Phase; ClamAV runs before transition; simpler transaction boundary |
| FK structure for step-attachments | Add `workflow_history_id CHAR(36) NULL` to `attachments` table | ADR-021 explicit; backward-compatible (existing attachments = NULL) |
| Workflow History UUID type | `CHAR(36)` — `@PrimaryGeneratedColumn('uuid')` (NOT `UuidBaseEntity`) | Existing entity pattern; FK in attachments mirrors this |
| Existing visualizer reuse | `components/custom/workflow-visualizer.tsx` is **horizontal** — new `workflow-lifecycle.tsx` is **vertical** | Different layout semantics; keep both |
| Idempotency storage | Redis key: `idempotency:transition:{idempotencyKey}:{userId}` → serialized response (TTL: 24h) | Per .windsurfrules Security Rule #1 + ADR-021 §5.1 |
| Cache invalidation | On `processTransition()` success → invalidate Redis key `wf:history:{instanceId}` | ADR-021 §9 — override TTL on state change |

---

## Phase 1: Design Decisions

### 1.1 Data Model

→ See `data-model.md` for complete entity definitions.

**Key decisions:**
- `attachments.workflow_history_id` = `CHAR(36) NULL` FK → `workflow_histories.id`
- `ON DELETE SET NULL` (preserve attachment records if history row deleted)
- Composite index: `INDEX idx_att_wfhist_created (workflow_history_id, created_at)`
- `WorkflowHistory` gains `@OneToMany(() => Attachment, a => a.workflowHistory)` — **lazy-loaded only** (don't include in default `findOne` to avoid N+1)

### 1.2 API Contract

→ See `contracts/workflow-transition.yaml` for OpenAPI spec.

**Extended `POST /workflow-engine/instances/:instanceId/transition`:**
```
Header: Idempotency-Key: <UUIDv7>
Body: {
  action: string               // existing
  comment?: string             // existing
  payload?: Record             // existing
  attachmentPublicIds?: string[] // NEW — UUIDv7 list of pre-uploaded attachments
}
```

**New `GET /workflow-engine/instances/:instanceId/history`:**
```
Response: WorkflowHistoryItem[] with nested attachments[] per step
```

### 1.3 Frontend Architecture

3 new components follow **compound pattern**:
```
<IntegratedBanner document={doc} workflowInstance={instance} onAction={...} />
  └── uses: <PriorityBadge />, <StatusBadge />, <WorkflowActionButtons />

<WorkflowLifecycle instance={instance} onFileClick={openPreview} />
  └── vertical timeline, Indigo active step (pulse animation)
  └── each step: StepCard with date, actor, comment, attachments[]

<FilePreviewModal file={attachment} onClose={...} />
  └── PDF: <iframe src="/api/files/preview/:publicId" />
  └── Image: <img src="/api/files/preview/:publicId" />
```

**`use-workflow-action` hook responsibilities:**
1. Validate `Idempotency-Key` (generate UUIDv7 once per action intent)
2. Ensure all `attachmentPublicIds` are committed (not temp) before transition
3. Call `POST /instances/:id/transition` with `Idempotency-Key` header
4. Invalidate TanStack Query cache for the document + workflow instance

---

## Phase 2: Task Breakdown

### 🔴 CRITICAL (must complete in order)

| # | Task | File(s) | Dependencies |
|---|------|---------|--------------|
| T1 | Create SQL delta — add `workflow_history_id` to `attachments` | `deltas/04-*.sql` | None |
| T2 | Update `attachment.entity.ts` — add `workflowHistoryId` column + relation | `attachment.entity.ts` | T1 |
| T3 | Update `workflow-history.entity.ts` — add `@OneToMany attachments` | `workflow-history.entity.ts` | T1 |
| T4 | Extend `WorkflowTransitionDto` — add `attachmentPublicIds` | `workflow-transition.dto.ts` | None |
| T5 | Create `WorkflowTransitionGuard` (CASL 4-Level RBAC) | `guards/workflow-transition.guard.ts` | None |
| T6 | Extend `WorkflowEngineService.processTransition()` — resolve attachment IDs + link to history | `workflow-engine.service.ts` | T2, T3, T4 |
| T7 | Update `WorkflowEngineController` — add idempotency header validation + guard + history endpoint | `workflow-engine.controller.ts` | T5, T6 |
| T8 | Register guard in `WorkflowEngineModule` | `workflow-engine.module.ts` | T5 |

### 🟡 IMPORTANT (frontend, after backend complete)

| # | Task | File(s) | Dependencies |
|---|------|---------|--------------|
| F1 | Update `frontend/types/workflow.ts` — add `WorkflowHistoryItem` with `attachments[]` | `types/workflow.ts` | T7 |
| F2 | Update `workflow-engine.dto.ts` — add `WorkflowTransitionWithAttachmentsDto` | `types/dto/workflow-engine/workflow-engine.dto.ts` | T4 |
| F3 | Create `use-workflow-action.ts` hook | `hooks/use-workflow-action.ts` | F2 |
| F4 | Create `IntegratedBanner` component | `components/workflow/integrated-banner.tsx` | F1 |
| F5 | Create `WorkflowLifecycle` component (vertical timeline) | `components/workflow/workflow-lifecycle.tsx` | F1 |
| F6 | Create `FilePreviewModal` component | `components/common/file-preview-modal.tsx` | F1 |
| F7 | Refactor RFA detail page — integrate new components | `rfas/[uuid]/page.tsx` | F3–F6 |
| F8 | Refactor Correspondence detail page — integrate new components | `correspondences/[uuid]/page.tsx` | F3–F6 |

### 🟢 GUIDELINES (after F7/F8)

| # | Task | File(s) | Dependencies |
|---|------|---------|--------------|
| G1 | Add i18n keys for all new UI text | `locales/th.json`, `locales/en.json` | F4–F8 |
| G2 | Write unit tests — `WorkflowEngineService.processTransition()` extended paths | `workflow-engine.service.spec.ts` | T6 |
| G3 | Write unit tests — `WorkflowTransitionGuard` RBAC paths | `guards/workflow-transition.guard.spec.ts` | T5 |
| G4 | Write component tests — `IntegratedBanner`, `WorkflowLifecycle`, `FilePreviewModal` | `*.test.tsx` | F4–F6 |
| G5 | E2E test — complete workflow transition with file upload | `test/workflow-with-attachment.e2e-spec.ts` | All |

---

## Phase 3: Verification Plan

### Backend Verification
```bash
# 1. Schema check
grep -n "workflow_history_id" specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
# after applying delta — should exist

# 2. Unit tests
cd backend && pnpm test --testPathPattern=workflow-engine.service
cd backend && pnpm test --testPathPattern=workflow-transition.guard

# 3. Integration — transition with attachment
curl -X POST http://localhost:3001/api/workflow-engine/instances/:id/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"action":"APPROVE","comment":"OK","attachmentPublicIds":["<uuid>"]}'
# Expect 200 { success: true, nextState: "...", historyId: "..." }

# 4. Verify attachment linked
curl http://localhost:3001/api/workflow-engine/instances/:id/history
# attachment in correct step should have workflowHistoryId set
```

### Frontend Verification
```bash
cd frontend && pnpm test --run  # Vitest
# All component tests pass
# IntegratedBanner renders Priority badge correctly (URGENT/HIGH/MEDIUM/LOW)
# WorkflowLifecycle highlights active step with Indigo + pulse
# FilePreviewModal opens PDF in iframe
```

### Security Verification
- [ ] `Idempotency-Key` missing → `400 Bad Request`
- [ ] Duplicate `Idempotency-Key` → `200` with cached response (no re-processing)
- [ ] Unauthorized user (not handler, not admin) → `403 Forbidden`
- [ ] ClamAV test file (EICAR) upload → blocked before transition
- [ ] `attachmentPublicIds` with non-temp (already-committed) UUID → rejected

---

## Dependencies Map

```
ADR-021
  ├── ADR-001 (Workflow Engine DSL) — extends processTransition()
  ├── ADR-002 (Redis Redlock) — existing lock pattern applied to transition
  ├── ADR-016 (Security) — Two-Phase upload, ClamAV, CASL Guard
  ├── ADR-019 (UUID) — publicId for all attachment references
  └── ADR-008 (BullMQ) — notification dispatch (unchanged, existing pattern)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| N+1 query on history + attachments join | Medium | High | Eager-load only when explicitly querying history; Redis cache TTL 1h |
| Race condition: 2 users upload to same step simultaneously | Low | High | Redis Redlock on `instanceId` — only 1 transition allowed at a time |
| Attachment linked to wrong history record | Low | High | `processTransition()` creates history row first, then links attachments in same transaction |
| ClamAV timeout during upload | Low | Medium | Upload endpoint has its own timeout; transition is decoupled |
| Frontend: stale workflow state after transition | Medium | Medium | `use-workflow-action` hook invalidates TanStack Query cache on success |
