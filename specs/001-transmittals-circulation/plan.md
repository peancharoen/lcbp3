# Implementation Plan: Transmittals + Circulation Complete Integration (v1.8.8 with Revision Refactor)

**Branch**: `001-transmittals-circulation` | **Date**: 2026-04-29 | **Spec**: `specs/001-transmittals-circulation/spec.md`

---

## Summary

Wire up the ADR-021 `IntegratedBanner` + `WorkflowLifecycle` components (already imported as stubs) into the Transmittal and Circulation detail pages with live workflow data, add the missing `workflowInstanceId` exposure on both backend services, implement pending edge-case handlers (EC-RFA-004, EC-CIRC-001/002/003), and create missing TanStack Query hooks and list-page features.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict)
**Primary Dependencies**: NestJS 10, Next.js 14 (App Router), TypeORM, MariaDB, TanStack Query v5, shadcn/ui, TailwindCSS
**Storage**: MariaDB (via `workflow_instances` + `workflow_history` + `attachments` tables)
**Testing**: Vitest (frontend), Jest (backend)
**Target Platform**: QNAP Container Station (on-prem)
**Performance Goals**: Detail page loads workflow data < 1s; TanStack Query staleTime 60s
**Constraints**: ADR-009 (no migrations), ADR-019 (UUID strings only), ADR-016 (ClamAV), ADR-008 (BullMQ for notifications)

---

## Constitution Check

| Rule | Status | Notes |
|------|--------|-------|
| UUID patterns (ADR-019) — no parseInt | ✅ PASS | Use `publicId` string throughout |
| Schema changes via SQL delta (ADR-009) | ✅ PASS | No schema changes needed — additive response only |
| Security: CASL Guard on new endpoints | ✅ REQUIRED | Reassign/ForceClose endpoints need guards |
| Security: Idempotency-Key on workflow transitions | ✅ PASS | `use-workflow-action.ts` already sends key |
| BullMQ for notifications (ADR-008) | ✅ PASS | Existing NotificationService handles this |
| No `any` types | ✅ REQUIRED | Strict TypeScript enforcement |
| Thin controllers, business logic in services | ✅ PASS | Following existing RFA/Correspondence pattern |
| Test coverage ≥ 80% business logic | ⚠️ REQUIRED | New service methods need unit tests |
| Redis Redlock for document numbering | ✅ N/A | No new document numbering in this feature |

---

## Project Structure

### Documentation

```text
specs/001-transmittals-circulation/
├── spec.md              ✅ done
├── plan.md              ✅ this file
├── data-model.md        (inline in this plan)
└── tasks.md             (next step)
```

### Source Code Changes

```text
backend/src/modules/
├── workflow-engine/
│   └── workflow-engine.service.ts          [ADD] getInstanceByEntity()
├── transmittal/
│   ├── transmittal.service.ts              [MODIFY] findOneByUuid + findAll + EC-RFA-004
│   └── transmittal.controller.ts           [MODIFY] add /submit endpoint
├── circulation/
│   ├── circulation.service.ts              [MODIFY] findOneByUuid + reassign + forceClose
│   └── circulation.controller.ts           [MODIFY] add /reassign + /force-close endpoints

frontend/
├── types/
│   ├── transmittal.ts                      [MODIFY] add workflowInstanceId, workflowState, availableActions
│   └── circulation.ts                      [MODIFY] add workflowInstanceId, workflowState, deadline fields
├── hooks/
│   ├── use-transmittal.ts                  [NEW] useTransmittal(uuid) hook
│   └── use-circulation.ts                  [MODIFY] add useCirculation(uuid)
├── app/(dashboard)/
│   ├── transmittals/[uuid]/page.tsx        [MODIFY] wire IntegratedBanner + WorkflowLifecycle
│   └── circulation/[uuid]/page.tsx         [MODIFY] wire IntegratedBanner + WorkflowLifecycle + Overdue
└── public/locales/
    ├── th/transmittal.json                 [ADD/UPDATE] i18n keys
    └── en/transmittal.json                 [ADD/UPDATE] i18n keys
```

---

## Phase 0: Research Findings

### Key Design Decisions

1. **`workflowInstanceId` exposure**: No schema changes needed. The `WorkflowInstance` table has `entity_type` + `entity_id` columns. Add `getInstanceByEntity(entityType, entityId)` to `WorkflowEngineService`, then call it in `findOneByUuid` for both modules.

2. **Transmittal entityType**: Use `'transmittal'`; join via `workflow_instances WHERE entity_type = 'TRANSMITTAL' AND entity_id = correspondences.id` (string). Consistent with RFA pattern. **No separate FK column added.**

3. **Circulation entityType**: Use `'circulation'`; join via `workflow_instances WHERE entity_type = 'CIRCULATION' AND entity_id = circulations.id` (string). The Circulation entity already extends `UuidBaseEntity` (has `publicId`).

4. **Transmittal publicId**: The Transmittal entity has no own `publicId` — it shares `correspondence.publicId`. The service already maps it: `publicId: t.correspondence?.publicId`. This is correct; no change needed.

5. **EC-RFA-004 validation**: Fires in `TransmittalService.submit()` (new method). Check all `transmittal_items` → fetch their correspondence's current revision status → if any is DRAFT, throw `ValidationException`.

6. **EC-CIRC-001 (Reassign)**: New `CirculationService.reassignRouting(routingId, newAssigneeUuid, user)`. Requires `Document Control` or above role (`ability.can('reassign', 'Circulation')`). Updates `routing.assignedTo` to the new user's INT id.

7. **EC-CIRC-002 (Force Close) — Synchronous, ≤3s SLA**: New `CirculationService.forceClose(uuid, reason, user)`. Requires `Document Control` or above (`ability.can('forceClose', 'Circulation')`). All routing status updates + audit log committed in **a single DB transaction**; respond `200 OK` after commit. BullMQ notification jobs enqueued **post-commit** (not inside transaction). SLA: ≤ 3 seconds for ≤ 50 routings.

8. **EC-CIRC-003 (Overdue) — Server-side**: `CirculationService.findOneByUuid()` computes `isOverdue = NOW() > deadline_date + INTERVAL 1 DAY` per routing and returns `isOverdue: boolean` in the response. **Frontend MUST NOT compute overdue independently** — render badge based solely on backend field. Unit test: `CirculationService` spec with mocked `Date`/`ClockService`.

9. **EC-CORR-001 (Cancel Correspondence → Force-close Circulations)**: When Correspondence is cancelled, all OPEN Circulations are force-closed + audit log written. A BullMQ job is enqueued **per affected assignee** with pending routing on queue `notification-queue`. Job payload: `{ circulationNo, correspondenceNo, cancellationReason }`. No inline notification.

10. **Close Circulation (FR-C09) RBAC**: The "Close Circulation" action (all Main/Action assignees COMPLETED) is exposed **only to Document Control** — guarded by `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` with `ability.can('close', 'Circulation')`. Frontend hides button for all other roles.

---

## Phase 1: Design Decisions

### Data Model Changes (No SQL delta required)

The `WorkflowInstance` table already exists with `entity_type VARCHAR`, `entity_id VARCHAR`. The only change is:
- **Add** `getInstanceByEntity(entityType, entityId)` to `WorkflowEngineService` (TypeORM query, no schema change).

### API Contract

#### `GET /transmittals/:uuid`

**Response addition** (existing fields unchanged):
```json
{
  "data": {
    "publicId": "...",
    "workflowInstanceId": "019abc...",
    "workflowState": "IN_REVIEW",
    "availableActions": ["APPROVE", "REJECT"],
    ...existing fields...
  }
}
```

#### `GET /circulation/:uuid`

**Response addition**:
```json
{
  "data": {
    "publicId": "...",
    "workflowInstanceId": "019def...",
    "workflowState": "OPEN",
    "availableActions": [],
    "isOverdue": false,
    "routings": [
      {
        "assigneePublicId": "...",
        "assigneeType": "MAIN",
        "deadline": "2026-04-20T00:00:00.000Z",
        "isOverdue": true,
        "status": "PENDING",
        ...
      }
    ],
    ...
  }
}
```

> ⚠️ `isOverdue` is computed **server-side** in `CirculationService` (`NOW() > deadline_date + INTERVAL 1 DAY`). Frontend must NOT recompute this field.

#### `POST /transmittals/:uuid/submit` (NEW)

**Request**:
```json
{ "templateId": "optional-workflow-template-uuid" }
```
**Response**: `{ "instanceId": "...", "currentState": "IN_REVIEW" }`
**Error (EC-RFA-004)**: `422` `{ "message": "RFA [doc-no] ยังอยู่ใน Draft กรุณา Submit ก่อน" }`

#### `PATCH /circulation/:id/routing/:routingId/reassign` (NEW)

**Request**: `{ "newAssigneeId": "uuid" }`
**Guards**: `@RequirePermission('circulation.manage')`

#### `POST /circulation/:id/force-close` (NEW)

**Request**: `{ "reason": "mandatory string" }`
**Guards**: `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` with `ability.can('forceClose', 'Circulation')`
**Response**: `{ "success": true }`
**Behaviour**: Synchronous. Single DB transaction (all routing updates + audit log). BullMQ notification per assignee enqueued post-commit. **SLA: ≤ 3 seconds** for ≤ 50 routings.

#### `POST /circulation/:id/close` (NEW)

**Guards**: `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` with `ability.can('close', 'Circulation')` — **Document Control only**
**Pre-condition**: All Main/Action routings must be in COMPLETED state (server validates; 422 if not)
**Response**: `{ "success": true }`

### Frontend Architecture

#### `useTransmittal(uuid)` hook
```ts
useQuery<Transmittal>({
  queryKey: ['transmittal', uuid],
  queryFn: () => transmittalService.getByUuid(uuid),
  enabled: !!uuid,
  staleTime: 60_000,
})
```
Returns: `{ transmittal, isLoading, error }` — replaces inline `useQuery` in detail page.

#### `useCirculation(uuid)` hook
```ts
useQuery<Circulation>({
  queryKey: ['circulation', uuid],
  queryFn: () => circulationService.getByUuid(uuid),
  enabled: !!uuid,
  staleTime: 60_000,
})
```

#### `useWorkflowHistory(instanceId)` — already exists, use directly in pages.

#### Overdue Badge logic (backend-computed, frontend renders)
```ts
// ✅ CORRECT — render from backend field only
const isRoutingOverdue = routing.isOverdue; // boolean from API

// ❌ FORBIDDEN — frontend must NOT recompute
// const isOverdue = new Date() > new Date(routing.deadline);
```
The `isOverdue` field is computed in `CirculationService.findOneByUuid()` via:
```ts
const isOverdue = new Date() > addDays(new Date(routing.deadline), 1);
```
Unit test: mock `Date` in `circulation.service.spec.ts` (or inject `ClockService`).

---

## Phase 2: Task Breakdown

### Critical (Backend)

| Task | File | Description |
|------|------|-------------|
| B1 | `workflow-engine.service.ts` | Add `getInstanceByEntity(entityType, entityId)` — join `workflow_instances WHERE entity_type = ? AND entity_id = ?`; returns `{ id, currentState }` or null |
| B2 | `transmittal.service.ts` | `findOneByUuid`: join workflow instance via `entity_type='TRANSMITTAL'`, `entity_id=correspondences.id`; add `workflowInstanceId` to response |
| B3 | `transmittal.service.ts` | `findAll`: add `purpose` filter |
| B4 | `transmittal.service.ts` | Add `submit(uuid, user)` with EC-RFA-004 validation (pre-transition check) |
| B5 | `transmittal.controller.ts` | Add `POST /:uuid/submit` endpoint with `CaslAbilityGuard` |
| B6 | `circulation.service.ts` | `findOneByUuid`: join workflow instance via `entity_type='CIRCULATION'`, `entity_id=circulations.id`; compute `isOverdue: boolean` server-side per routing |
| B7 | `circulation.service.ts` | Add `reassignRouting(routingId, newAssigneeUuid, user)` — guard `ability.can('reassign', 'Circulation')` |
| B8 | `circulation.service.ts` | Add `forceClose(uuid, reason, user)` — single DB transaction; enqueue BullMQ `notification-queue` post-commit; SLA ≤ 3s / 50 routings |
| B9 | `circulation.service.ts` | Add `close(uuid, user)` — Document Control only; pre-condition all Main/Action routings COMPLETED |
| B10 | `circulation.controller.ts` | Add PATCH `/routing/:id/reassign` + POST `/force-close` + POST `/close` with CASL guards |
| B11 | `correspondence.service.ts` | On cancel: force-close all OPEN Circulations + enqueue BullMQ `notification-queue` job per affected assignee (EC-CORR-001, FR-X05) |

### Important (Frontend)

| Task | File | Description |
|------|------|-------------|
| F1 | `types/transmittal.ts` | Add `workflowInstanceId?`, `workflowState?`, `availableActions?` |
| F2 | `types/circulation.ts` | Add `workflowInstanceId?`, `workflowState?`, `isOverdue: boolean` per routing (backend-provided) |
| F3 | `hooks/use-transmittal.ts` | New `useTransmittal(uuid)` hook |
| F4 | `hooks/use-circulation.ts` | Add `useCirculation(uuid)` hook |
| F5 | `transmittals/[uuid]/page.tsx` | Wire banner + lifecycle with real data |
| F6 | `circulation/[uuid]/page.tsx` | Wire banner + lifecycle + Overdue badge from `routing.isOverdue` (backend field — no client-side date math); show "Close Circulation" button only when `canClose && user.role === 'DOCUMENT_CONTROL'` |
| F7 | `transmittals/page.tsx` | Verify list page works, add purpose filter |

### Guidelines (i18n + Tests)

| Task | File | Description |
|------|------|-------------|
| I1 | `public/locales/th/*.json` + `en/*.json` | Add missing transmittal/circulation workflow keys (force-close modal, overdue badge, close action) |
| T1 | `transmittal.service.spec.ts` | Unit test EC-RFA-004 submit validation (422 on DRAFT item) |
| T2 | `circulation.service.spec.ts` | Unit tests: EC-CIRC-001 reassign, EC-CIRC-002 force-close (transaction + BullMQ enqueue), EC-CIRC-003 `isOverdue` with mocked Date, EC-CORR-001 notification job enqueue |
| T3 | `circulation.service.spec.ts` | Integration test: Force Close with 50 routings completes within 3s (SC-008) |

---

## Phase 3: Verification Plan

### Backend
```bash
# TypeScript compile
cd backend && pnpm tsc --noEmit

# Unit tests (target files)
cd backend && pnpm jest --testPathPattern="transmittal|circulation"

# Manual curl — Transmittal detail with workflowInstanceId
curl http://localhost:3001/api/transmittals/{uuid} | jq '.data.workflowInstanceId'

# Manual curl — Circulation detail with workflowInstanceId
curl http://localhost:3001/api/circulation/{uuid} | jq '.data.workflowInstanceId'

# EC-RFA-004 — submit transmittal with DRAFT item (expect 422)
curl -X POST http://localhost:3001/api/transmittals/{uuid}/submit

# Force Close test
curl -X POST http://localhost:3001/api/circulation/{uuid}/force-close \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test force close"}'
```

### Frontend
```bash
# TypeScript compile (zero errors)
cd frontend && pnpm tsc --noEmit

# Lint (zero warnings)
cd frontend && pnpm lint

# Vitest unit tests
cd frontend && pnpm test

# Manual: Navigate to /transmittals/{uuid}
#   → IntegratedBanner shows doc number + status badge
#   → Workflow tab shows history timeline
#   → workflowState shown in banner (if instance exists)

# Manual: Navigate to /circulation/{uuid}
#   → Overdue badge on past-deadline routings
#   → Workflow tab shows history
```

### Security Verification
- [ ] Reassign endpoint: 403 if user is not Document Control or above (`ability.can('reassign', 'Circulation')`)
- [ ] Force Close endpoint: 403 if user is not Document Control or above (`ability.can('forceClose', 'Circulation')`)
- [ ] Close Circulation endpoint: 403 for all non-Document Control roles (`ability.can('close', 'Circulation')`)
- [ ] Close Circulation: 422 if any Main/Action routing is not COMPLETED
- [ ] Workflow transition: `Idempotency-Key` header enforced
- [ ] No `parseInt` on any UUID in new code
- [ ] `workflowInstanceId` is string (not number) in all responses
- [ ] EC-CORR-001: BullMQ notification job enqueued, NOT inline in request thread
- [ ] `isOverdue` on Circulation response is boolean from backend — no frontend date math

---

## Dependencies Map

```
ADR-001 (Unified Workflow Engine)
  └→ WorkflowEngineService.getInstanceByEntity() [B1]
       ├→ TransmittalService.findOneByUuid() [B2]
       └→ CirculationService.findOneByUuid() [B6]
            ├→ types/transmittal.ts [F1]
            ├→ types/circulation.ts [F2]
            ├→ useTransmittal() [F3]
            ├→ useCirculation() [F4]
            ├→ transmittals/[uuid]/page.tsx [F5]
            └→ circulation/[uuid]/page.tsx [F6]

ADR-016 (Security/RBAC)
  └→ CirculationService.reassignRouting() [B7]
  └→ CirculationService.forceClose() [B8]

ADR-021 (IntegratedBanner/WorkflowLifecycle components)
  └→ Already implemented — just need instanceId prop wired [F5, F6]
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| `entity_type` mismatch — Transmittal uses wrong entityType in WF instance | Medium | High | Join via `entity_type='TRANSMITTAL'` + `entity_id=correspondences.id` consistently in `getInstanceByEntity()` |
| Circulation has no WF instance (workflow never started) | High | Medium | `getInstanceByEntity()` returns null → `workflowInstanceId` = undefined → banner shows status only, no actions |
| Transmittal entity has no `publicId` own column | Medium | Low | Already handled: `publicId` maps from `correspondence.publicId` in `findAll()` |
| EC-CIRC-003 timezone — server TZ differs from Bangkok | Low | High | Compute `isOverdue` in MariaDB with `NOW()` (server TZ is UTC+7 per docker-compose); verify in unit test with fixed timestamp |
| Force Close latency > 3s with 50+ routings | Low | Medium | Use bulk UPDATE query (not loop), wrap in single transaction; add integration test SC-008 |
| EC-CORR-001 notification lost if BullMQ unavailable | Low | High | BullMQ persistence (Redis AOF) ensures job survives restarts; dead-letter queue `notification-queue-failed` alerts ops |

---

## Phase 4: Transmittal Revision Refactor (v1.8.8)

**Based on**: Clarifications Session 2026-04-29
**Goal**: Restructure Transmittal to follow Master-Revision Pattern like RFA/Correspondence

### Clarification Decisions Applied

| Decision | Implementation |
|----------|----------------|
| **B** — Reuse `correspondence_revisions` | Transmittal-specific data (`purpose`, `remarks`) stored in `correspondence_revisions.details` JSON field |
| **A** — Copy items on revision | When creating new revision, clone all `transmittal_items` with new `revision_id` |
| **B** — Add `revision_id` column | Schema change: `ALTER TABLE transmittal_items ADD revision_id INT NULL FK` |
| **A** — Workflow binds to current revision | `workflow_instances.entity_id` references `correspondence_revisions.id` (not master) |
| **B** — Keep same document number | Revision label (A, B, C) distinguishes versions; doc number unchanged |

### Schema Changes (ADR-009 — SQL Direct)

```sql
-- 1. Add revision_id to transmittal_items (backward compatible)
ALTER TABLE transmittal_items
  ADD COLUMN revision_id INT NULL COMMENT 'FK to correspondence_revisions' AFTER transmittal_id,
  ADD CONSTRAINT fk_transmittal_items_revision
    FOREIGN KEY (revision_id) REFERENCES correspondence_revisions(id) ON DELETE CASCADE,
  ADD INDEX idx_transmittal_items_revision (revision_id);

-- 2. Add item_type column to transmittal_items (H1 fix)
ALTER TABLE transmittal_items
  ADD COLUMN item_type VARCHAR(50) NULL COMMENT 'ประเภทเอกสาร เช่น DRAWING, RFA, CORRESPONDENCE' AFTER item_correspondence_id;

-- 3. Drop deprecated columns from transmittals table (ADR-009)
--    Run AFTER R14 (service updated to write purpose/remarks → revision.details) is deployed
ALTER TABLE transmittals
  DROP COLUMN purpose,
  DROP COLUMN remarks;
```

### Data Model Update

```
correspondences (Master - type_code='TRANSMITTAL')
  └── correspondence_revisions (Revisions)
        ├── details.purpose      ← Transmittal purpose (JSON)
        ├── details.remarks    ← Transmittal remarks (JSON)
        └── transmittal_items (with revision_id FK)
              └── item_correspondence_id → correspondences.id
```

### Backend Changes

| Task | File | Description |
|------|------|-------------|
| R1 | `transmittal.service.ts` | Update `findOneByUuid` to join `correspondence_revisions` and read `purpose`/`remarks` from `details` JSON |
| R2 | `transmittal.service.ts` | Add `createRevision()` method — copy items automatically, link to new revision |
| R3 | `transmittal.service.ts` | Update `submit()` to work with revision-scoped items (EC-RFA-004) |
| R4 | `transmittal-item.entity.ts` | Add `revisionId` column (nullable, FK to `correspondence_revisions.id`) |
| R5 | `transmittal.service.ts` | Add `copyItemsToRevision(oldRevisionId, newRevisionId)` helper |
| R6 | `workflow-engine.service.ts` | Update `getInstanceByEntity` to support `entity_type='transmittal'` with `entity_id=revision.publicId` (UUID string, ADR-019 — NOT INT revision.id) |
| R17 | `transmittal-item.entity.ts` + `transmittal.service.ts` + `schema-02-tables.sql` | Add `item_type VARCHAR(50) NULL` column to `transmittal_items` table (ADR-009 SQL), add TypeORM column, save `item.itemType` in `create()` — Fixes H1 |
| R18 | `transmittal.service.ts` | Replace `ORG_CODE: 'ORG'` hardcode with real `organizationCode` lookup via `dataSource.manager.findOne(Organization, { where: { id: userOrgId } })` — Fixes M1 |

### Frontend Changes

| Task | File | Description |
|------|------|-------------|
| R7 | `types/transmittal.ts` | Add `revisionId`, `revisionNumber`, `revisionLabel` to `Transmittal` type |
| R8 | `types/transmittal.ts` | Add `revisionId` to `TransmittalItem` type |
| R9 | `transmittals/[uuid]/page.tsx` | Show revision selector (like RFA) when multiple revisions exist |
| R10 | `transmittals/[uuid]/page.tsx` | Display revision label (A, B, C) in banner |

### API Contract Changes

#### `GET /transmittals/:uuid` (Updated)

```json
{
  "data": {
    "publicId": "...",
    "revisionId": "019abc...",
    "revisionNumber": 1,
    "revisionLabel": "A",
    "purpose": "FOR_APPROVAL",
    "remarks": "...",
    "workflowInstanceId": "019def...",
    "items": [
      {
        "id": 1,
        "revisionId": "019abc...",
        "itemCorrespondenceId": "...",
        ...
      }
    ]
  }
}
```

#### `POST /transmittals/:uuid/revisions` (NEW)

**Request**: `{ "remarks": "optional revision reason" }`
**Response**: `{ "revisionId": "...", "revisionNumber": 2, "revisionLabel": "B" }`
**Action**: Creates new `correspondence_revisions` record, copies all items automatically
**Guards**: Document Control or above

### Constitution Check (Revision Refactor)

| Rule | Status | Notes |
|------|--------|-------|
| ADR-009 — Schema changes via SQL | ✅ REQUIRED | Add `revision_id` via direct SQL, no TypeORM migration |
| ADR-019 — UUID strings | ✅ REQUIRED | All IDs use `publicId` string |
| ADR-021 — Workflow Context | ✅ REQUIRED | Workflow binds to `correspondence_revisions.publicId` (UUID string, ADR-019) |
| Master-Revision Pattern | ✅ REQUIRED | Aligns with RFA/Correspondence pattern |

### Risk Register (Revision Refactor)

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Data migration complexity | Medium | High | Backward-compatible NULLable `revision_id`; migrate existing items post-deploy |
| Workflow instance re-binding | Medium | High | New revision = new workflow target; historical revisions preserve state |
| Correspondence type detection | Low | Medium | Ensure `type_code='TRANSMITTAL'` when querying revisions |

---
