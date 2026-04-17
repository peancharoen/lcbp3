# Implementation Plan: Transmittals + Circulation Complete Integration (v1.8.7 Post-ADR-021)

**Branch**: `001-transmittals-circulation` | **Date**: 2026-04-12 | **Spec**: `specs/001-transmittals-circulation/spec.md`

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

2. **Transmittal entityType**: Use `'transmittal'` (matching the entity ID = `correspondence.id.toString()`). Consistent with how RFA uses `'rfa'`.

3. **Circulation entityType**: Use `'circulation'` (entity ID = `circulation.id.toString()`). The Circulation entity already extends `UuidBaseEntity` (has `publicId`).

4. **Transmittal publicId**: The Transmittal entity has no own `publicId` — it shares `correspondence.publicId`. The service already maps it: `publicId: t.correspondence?.publicId`. This is correct; no change needed.

5. **EC-RFA-004 validation**: Fires in `TransmittalService.submit()` (new method). Check all `transmittal_items` → fetch their correspondence's current revision status → if any is DRAFT, throw `ValidationException`.

6. **EC-CIRC-001 (Reassign)**: New `CirculationService.reassignRouting(routingId, newAssigneeUuid, user)`. Requires `Document Control` or above role. Updates `routing.assignedTo` to the new user's INT id.

7. **EC-CIRC-002 (Force Close)**: New `CirculationService.forceClose(circulationId, reason, user)`. Requires `Document Control` or above. Updates all PENDING routings to `CANCELLED`, sets `circulation.statusCode = 'CANCELLED'`, writes audit log.

8. **EC-CIRC-003 (Overdue)**: Pure frontend logic. Compare `routing.deadline` with `new Date()`. Show `OverdueBadge` if `now > deadline + 1 day`. No backend change needed.

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
    "routings": [
      {
        "id": 1,
        "deadline": "2026-04-20T00:00:00.000Z",
        "isOverdue": true,
        ...
      }
    ],
    ...
  }
}
```

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
**Guards**: `@RequirePermission('circulation.manage')`
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

#### Overdue Badge logic (frontend-only)
```ts
function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  const deadlinePlusOne = new Date(deadline);
  deadlinePlusOne.setDate(deadlinePlusOne.getDate() + 1);
  return new Date() > deadlinePlusOne;
}
```

---

## Phase 2: Task Breakdown

### Critical (Backend)

| Task | File | Description |
|------|------|-------------|
| B1 | `workflow-engine.service.ts` | Add `getInstanceByEntity(entityType, entityId)` returning `{ id, currentState }` or null |
| B2 | `transmittal.service.ts` | `findOneByUuid`: lookup workflow instance, add to response |
| B3 | `transmittal.service.ts` | `findAll`: add `purpose` filter |
| B4 | `transmittal.service.ts` | Add `submit(uuid, user)` with EC-RFA-004 validation |
| B5 | `transmittal.controller.ts` | Add `POST /:uuid/submit` endpoint with guard |
| B6 | `circulation.service.ts` | `findOneByUuid`: lookup workflow instance, compute overdue |
| B7 | `circulation.service.ts` | Add `reassignRouting(routingId, newAssigneeUuid, user)` |
| B8 | `circulation.service.ts` | Add `forceClose(uuid, reason, user)` with EC-CIRC-002 |
| B9 | `circulation.controller.ts` | Add PATCH `/routing/:id/reassign` + POST `/force-close` |

### Important (Frontend)

| Task | File | Description |
|------|------|-------------|
| F1 | `types/transmittal.ts` | Add `workflowInstanceId?`, `workflowState?`, `availableActions?` |
| F2 | `types/circulation.ts` | Add `workflowInstanceId?`, `workflowState?`, deadline to routing |
| F3 | `hooks/use-transmittal.ts` | New `useTransmittal(uuid)` hook |
| F4 | `hooks/use-circulation.ts` | Add `useCirculation(uuid)` hook |
| F5 | `transmittals/[uuid]/page.tsx` | Wire banner + lifecycle with real data |
| F6 | `circulation/[uuid]/page.tsx` | Wire banner + lifecycle + overdue badge |
| F7 | `transmittals/page.tsx` | Verify list page works, add purpose filter |

### Guidelines (i18n + Tests)

| Task | File | Description |
|------|------|-------------|
| I1 | `public/locales/th/*.json` | Add missing transmittal/circulation workflow keys |
| T1 | `transmittal.service.spec.ts` | Unit test EC-RFA-004 submit validation |
| T2 | `circulation.service.spec.ts` | Unit tests EC-CIRC-001/002/003 handlers |

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
- [ ] Reassign endpoint: 403 if user is not Document Control or above
- [ ] Force Close endpoint: 403 if user is not Document Control or above
- [ ] Workflow transition: `Idempotency-Key` header enforced
- [ ] No `parseInt` on any UUID in new code
- [ ] `workflowInstanceId` is string (not number) in all responses

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
| `entity_type` mismatch — Transmittal uses wrong entityType in WF instance | Medium | High | Check `workflowEngine.createInstance()` call in `transmittal.service.ts`; use same entityType string consistently |
| Circulation has no WF instance (workflow never started) | High | Medium | `getInstanceByEntity()` returns null → `workflowInstanceId` = undefined → banner shows status only, no actions |
| Transmittal entity has no `publicId` own column | Medium | Low | Already handled: `publicId` maps from `correspondence.publicId` in `findAll()` |
| EC-CIRC-003 timezone issues (deadline at 23:59:59) | Low | Medium | Use UTC comparison; test with mocked date |
