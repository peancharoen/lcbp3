# Tasks: Transmittals + Circulation Complete Integration (v1.8.7 Post-ADR-021)

**Branch**: `001-transmittals-circulation` | **Total Tasks**: 18 | **Phase**: ✅ Complete (v1.8.7)

---

## Phase 1 — Backend Foundation (Critical — blocks all frontend work)

### B1 — WorkflowEngineService: Add `getInstanceByEntity()`
- **File**: `backend/src/modules/workflow-engine/workflow-engine.service.ts`
- **Action**: Add method that queries `WorkflowInstance` by `entityType + entityId`; returns `{ id, currentState, availableActions? } | null`
- **Dependencies**: none
- **Status**: [x]

### B2 — TransmittalService: Expose `workflowInstanceId` in `findOneByUuid()`
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Call `workflowEngine.getInstanceByEntity('transmittal', correspondenceId.toString())` and merge `workflowInstanceId`, `workflowState` into response
- **Dependencies**: B1
- **Status**: [x]

### B3 — TransmittalService: Add `purpose` filter to `findAll()`
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Add `purpose?: string` to `SearchTransmittalDto` and apply `andWhere` in `findAll()`
- **Dependencies**: none (parallel with B1)
- **Status**: [x]

### B4 — TransmittalService: Add `submit()` with EC-RFA-004 validation
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: New `submit(uuid, user)` method; fetches all `transmittal_items`, checks each item's correspondence current revision status — throws `422 ValidationException` if any is `DRAFT`; then calls `workflowEngine.createInstance('TRANSMITTAL_FLOW_V1', 'transmittal', ...)` and transitions with `SUBMIT`
- **Dependencies**: B1
- **Status**: [x]

### B5 — TransmittalController: Add `POST /:uuid/submit` endpoint
- **File**: `backend/src/modules/transmittal/transmittal.controller.ts`
- **Action**: Add endpoint with `@RequirePermission('document.manage')`, `@Audit('transmittal.submit', 'transmittal')`
- **Dependencies**: B4
- **Status**: [x]

### B6 — CirculationService: Expose `workflowInstanceId` in `findOneByUuid()`
- **File**: `backend/src/modules/circulation/circulation.service.ts`
- **Action**: Call `workflowEngine.getInstanceByEntity('circulation', circulation.id.toString())`, merge into response; also compute `isOverdue` per routing based on `deadline_date`
- **Dependencies**: B1
- **Status**: [x]

### B7 — CirculationService: Add `reassignRouting()` (EC-CIRC-001)
- **File**: `backend/src/modules/circulation/circulation.service.ts`
- **Action**: Fetch routing, verify user has Document Control permission, resolve `newAssigneeUuid` → INT via `uuidResolver.resolveUserId()`, update `routing.assignedTo`, write audit log
- **Dependencies**: none
- **Status**: [x]

### B8 — CirculationService: Add `forceClose()` (EC-CIRC-002)
- **File**: `backend/src/modules/circulation/circulation.service.ts`
- **Action**: Require `reason` (non-empty), update all PENDING routings to `CANCELLED`, set `circulation.statusCode = 'CANCELLED'`, write audit log entry; use `queryRunner` for atomicity
- **Dependencies**: none
- **Status**: [x]

### B9 — CirculationController: Add reassign + force-close endpoints
- **File**: `backend/src/modules/circulation/circulation.controller.ts`
- **Action**:
  - `PATCH /:uuid/routing/:routingId/reassign` — `@RequirePermission('circulation.manage')`
  - `POST /:uuid/force-close` — `@RequirePermission('circulation.manage')`
- **Dependencies**: B7, B8
- **Status**: [x]

---

## Phase 2 — Frontend Types & Hooks (Important — depends on Phase 1)

### F1 — Update `types/transmittal.ts`
- **File**: `frontend/types/transmittal.ts`
- **Action**: Add `workflowInstanceId?: string`, `workflowState?: string`, `availableActions?: string[]` to `Transmittal` interface; add `purpose?: string` to `SearchTransmittalDto`; no `any` types (ADR-019)
- **Dependencies**: none (parallel with Phase 1)
- **Status**: [x]

### F2 — Update `types/circulation.ts`
- **File**: `frontend/types/circulation.ts`
- **Action**: Add `workflowInstanceId?: string`, `workflowState?: string`, `availableActions?: string[]` to `Circulation`; add `deadline?: string`, `assigneeType?: 'MAIN' | 'ACTION' | 'INFORMATION'` to `CirculationRouting`
- **Dependencies**: none
- **Status**: [x]

### F3 — Create `hooks/use-transmittal.ts`
- **File**: `frontend/hooks/use-transmittal.ts`
- **Action**: Create `useTransmittal(uuid: string | undefined)` with `queryKey: ['transmittal', uuid]`, `staleTime: 60_000`; export `transmittalKeys` query key factory
- **Dependencies**: F1
- **Status**: [x]

### F4 — Update `hooks/use-circulation.ts`
- **File**: `frontend/hooks/use-circulation.ts`
- **Action**: Add `useCirculation(uuid: string | undefined)` hook with `queryKey: ['circulation', uuid]`, `staleTime: 60_000`
- **Dependencies**: F2
- **Status**: [x]

---

## Phase 3 — Frontend Detail Pages (Important — depends on Phase 2 + Phase 1 deployed)

### F5 — Wire Transmittal detail page
- **File**: `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`
- **Action**:
  - Replace inline `useQuery` with `useTransmittal(uuid)`
  - Add `useWorkflowHistory(transmittal?.workflowInstanceId)`
  - Add `const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([])`
  - Pass `instanceId`, `workflowState`, `availableActions`, `pendingAttachmentIds` to `IntegratedBanner`
  - Pass `history`, `currentState`, `isLoading`, `error`, `onAttachmentsChange` to `WorkflowLifecycle` in Workflow tab
- **Dependencies**: F3, F1
- **Status**: [x]

### F6 — Wire Circulation detail page
- **File**: `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`
- **Action**:
  - Replace inline `useQuery` with `useCirculation(uuid)`
  - Add `useWorkflowHistory(circulation?.workflowInstanceId)`
  - Add `isOverdue(deadline?)` helper function
  - Wire `IntegratedBanner` with `instanceId`, `workflowState`, `availableActions`
  - Wire `WorkflowLifecycle` with history in Workflow tab
  - Add Overdue badge to routing rows where `isOverdue(routing.deadline)` is true
  - Replace hardcoded "Complete" button with proper workflow action
- **Dependencies**: F4, F2
- **Status**: [x]

---

## Phase 4 — List Page & i18n (Guidelines)

### F7 — Transmittal list page: add purpose filter
- **File**: `frontend/app/(dashboard)/transmittals/page.tsx`
- **Action**: Add `purpose` select filter (FOR_APPROVAL / FOR_INFORMATION / FOR_REVIEW / OTHER) passing to `transmittalService.getAll()`. Read current page to assess if pagination works.
- **Dependencies**: F1
- **Status**: [x]

### I1 — i18n keys for Transmittal/Circulation workflow
- **Files**: `public/locales/th/*.json`, `public/locales/en/*.json`
- **Action**: Check `use-translations.ts` for key lookup pattern; add missing keys: `transmittal.purpose.*`, `circulation.status.*`, `circulation.overdue`, `circulation.forceClose.*`, `circulation.reassign.*`
- **Dependencies**: F5, F6
- **Status**: [ ] *(low priority — pending)*

---

## Phase 5 — Tests (Tier 2 — required before merge)

### T1 — Transmittal service EC-RFA-004 unit test
- **File**: `backend/src/modules/transmittal/transmittal.service.spec.ts` (create if needed)
- **Action**: Test `submit()` throws `ValidationException` when item correspondence is DRAFT; test passes when all items are SUBMITTED
- **Dependencies**: B4
- **Status**: [x]

### T2 — Circulation service edge-case unit tests
- **File**: `backend/src/modules/circulation/circulation.service.spec.ts` (create if needed)
- **Action**: Test `reassignRouting()` — permission check, assignment update; test `forceClose()` — all pending routings cancelled, reason logged; test `isOverdue` helper (EC-CIRC-003)
- **Dependencies**: B7, B8
- **Status**: [x]

---

## Execution Order

```
B1 (parallel: B3, F1, F2)
  → B2, B4 (parallel), B6 (parallel)
    → B5                  → T1
    → B7, B8 (parallel)
      → B9               → T2
  → F3, F4 (parallel after F1, F2)
    → F5, F6 (parallel after F3, F4)
      → F7, I1 (polish)
```

---

## Commit Message Convention

```
feat(transmittal): expose workflowInstanceId in findOneByUuid response
feat(circulation): expose workflowInstanceId + overdue in findOneByUuid
feat(circulation): add reassignRouting EC-CIRC-001 handler
feat(circulation): add forceClose EC-CIRC-002 handler
feat(transmittal): add submit endpoint with EC-RFA-004 validation
feat(frontend): wire WorkflowLifecycle in transmittal detail page
feat(frontend): wire WorkflowLifecycle + overdue badge in circulation detail
test(transmittal): EC-RFA-004 submit validation unit tests
test(circulation): EC-CIRC-001/002/003 edge case unit tests
```
