# Tasks: Transmittals + Circulation Complete Integration (v1.8.8 + Session 2026-05-03 Clarifications)

**Branch**: `001-transmittals-circulation`
**Total Tasks**: 46 (27 v1.8.7 + 19 v1.8.8 Phase 4) | **Spec**: `specs/001-transmittals-circulation/spec.md`
**Last Updated**: 2026-05-03 — Added B9c, B10, B11, T3, expanded T2/I1 from Session 2026-05-03 clarifications

---

## Phase 1 — Backend Foundation (Critical — blocks all frontend work)

> **Goal**: Expose `workflowInstanceId` from both backend services; implement all EC handlers.
> **Join pattern**: `workflow_instances WHERE entity_type = ? AND entity_id = ?` (string) — no new FK columns.

- [x] T001 Implement `WorkflowEngineService.getInstanceByEntity(entityType, entityId)` — query `workflow_instances WHERE entity_type = ? AND entity_id = ?`; return `{ id, currentState, availableActions? } | null` in `backend/src/modules/workflow-engine/workflow-engine.service.ts`

- [x] T002 [P] Update `TransmittalService.findOneByUuid()` — call `getInstanceByEntity('TRANSMITTAL', correspondences.id)`, merge `workflowInstanceId`, `workflowState` into response in `backend/src/modules/transmittal/transmittal.service.ts`

- [x] T003 [P] Add `purpose?: string` to `SearchTransmittalDto` and apply `andWhere` filter in `TransmittalService.findAll()` in `backend/src/modules/transmittal/transmittal.service.ts`

- [x] T004 Add `TransmittalService.submit(uuid, user)` — pre-check all `transmittal_items` for DRAFT correspondence (EC-RFA-004); throw `422 ValidationException` identifying offending doc; then call `workflowEngine.createInstance` + transition `SUBMIT` in `backend/src/modules/transmittal/transmittal.service.ts`

- [x] T005 Add `POST /:uuid/submit` endpoint with `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` + `@Audit('transmittal.submit', 'transmittal')` in `backend/src/modules/transmittal/transmittal.controller.ts`

- [x] T006 [P] Update `CirculationService.findOneByUuid()` — call `getInstanceByEntity('CIRCULATION', circulation.id)`, merge `workflowInstanceId`, `workflowState`; compute `isOverdue: boolean` **server-side** per routing (`NOW() > deadline_date + INTERVAL 1 DAY`) in `backend/src/modules/circulation/circulation.service.ts`

- [x] T007 [P] Add `CirculationService.reassignRouting(routingId, newAssigneeUuid, user)` — verify `ability.can('reassign', 'Circulation')` (Document Control+); resolve UUID→INT via `uuidResolver`; update `routing.assignedTo`; write audit log in `backend/src/modules/circulation/circulation.service.ts`

- [x] T008 [P] Add `CirculationService.forceClose(uuid, reason, user)` — single `queryRunner` transaction: update all PENDING routings to `CANCELLED`, set `circulation.statusCode = 'CANCELLED'`, write audit log; enqueue BullMQ `notification-queue` job **post-commit** per affected assignee (payload: `{ circulationNo, correspondenceNo, cancellationReason }`); verify `ability.can('forceClose', 'Circulation')` in `backend/src/modules/circulation/circulation.service.ts`

- [x] T009 Add `CirculationService.close(uuid, user)` — verify `ability.can('close', 'Circulation')` (Document Control only); pre-condition check: ALL Main/Action routings must be COMPLETED (throw `422` if not); update `circulation.statusCode = 'CLOSED'`; write audit log in `backend/src/modules/circulation/circulation.service.ts`

- [x] T010 Add PATCH `/:uuid/routing/:routingId/reassign` + POST `/:uuid/force-close` endpoints with `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` in `backend/src/modules/circulation/circulation.controller.ts`

- [x] T011 Add POST `/:uuid/close` endpoint with `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` (`ability.can('close', 'Circulation')`) + `@Audit('circulation.close', 'circulation')` in `backend/src/modules/circulation/circulation.controller.ts`

- [x] T012 Add EC-CORR-001 cascade handler in `CorrespondenceService.cancel()` — on cancel: find all OPEN Circulations for this correspondence; call `CirculationService.forceClose()` per Circulation; enqueue BullMQ `notification-queue` job per **affected assignee with pending routing** (payload: `{ circulationNo, correspondenceNo, cancellationReason }`); write combined audit log in `backend/src/modules/correspondence/correspondence.service.ts`

---

## Phase 2 — Frontend Types & Hooks (Important — depends on Phase 1 API shape)

- [x] T013 [P] Update `Transmittal` interface — add `workflowInstanceId?: string`, `workflowState?: string`, `availableActions?: string[]`; add `isOverdue?: boolean` to `CirculationRouting` (backend-provided, no client computation); no `any` types (ADR-019) in `frontend/types/transmittal.ts`

- [x] T014 [P] Update `Circulation` and `CirculationRouting` interfaces — add `workflowInstanceId?: string`, `workflowState?: string`, `availableActions?: string[]`; add `isOverdue: boolean`, `deadline?: string`, `assigneeType?: 'MAIN' | 'ACTION' | 'INFORMATION'` to `CirculationRouting` in `frontend/types/circulation.ts`

- [x] T015 Create `useTransmittal(uuid: string | undefined)` TanStack Query hook — `queryKey: ['transmittal', uuid]`, `staleTime: 60_000`, export `transmittalKeys` factory in `frontend/hooks/use-transmittal.ts`

- [x] T016 Add `useCirculation(uuid: string | undefined)` hook — `queryKey: ['circulation', uuid]`, `staleTime: 60_000` in `frontend/hooks/use-circulation.ts`

---

## Phase 3 — US1: Transmittal Workflow-Wired Detail Page (P1 🎯 MVP)

> **Story Goal**: Doc Control officer sees live doc number, `workflowState`, and action buttons in `IntegratedBanner`; Workflow tab shows full timeline.
> **Independent Test**: Navigate to `/transmittals/{uuid}` — verify `IntegratedBanner` shows real state + actions; Workflow tab renders at least creation step; `pnpm tsc --noEmit` zero errors.

- [x] T017 [US1] Wire `IntegratedBanner` with `instanceId={transmittal.workflowInstanceId}`, `workflowState`, `availableActions` from `useTransmittal()` hook; wire `WorkflowLifecycle` in Workflow tab with `useWorkflowHistory(instanceId)` in `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`

---

## Phase 4 — US2: Circulation Workflow-Wired Detail Page (P1 🎯 MVP)

> **Story Goal**: Doc Control sees circulation number, assignees with deadline, Overdue badge (from backend `isOverdue` field), full workflow timeline, and "Close Circulation" button (Document Control only when all Main/Action COMPLETED).
> **Independent Test**: Navigate to `/circulation/{uuid}` — verify `IntegratedBanner` shows `circulationNo`, `statusCode`; Overdue badge appears when `routing.isOverdue === true`; "Close Circulation" hidden for non-Document Control users.

- [x] T018 [US2] Wire `IntegratedBanner` + `WorkflowLifecycle` from `useCirculation()` + `useWorkflowHistory()` in `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`

- [ ] T019 [US2] Add Overdue badge to routing rows — render badge when `routing.isOverdue === true` (backend field only; **FORBIDDEN: no client-side `new Date()` comparison**); highlight `deadline` date in red in `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`

- [ ] T020 [US2] Show "Close Circulation" button conditionally — visible only when `user.role === 'DOCUMENT_CONTROL'` AND all Main/Action routings are `COMPLETED`; calls `POST /:uuid/close`; hide completely for all other roles in `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`

---

## Phase 5 — US3: Transmittal List Page with Search & Filter (P1)

> **Story Goal**: Doc Control browses transmittals, filters by `purpose`, searches by doc number/subject within 500ms.
> **Independent Test**: Navigate to `/transmittals` — purpose filter updates list; search filters within 500ms; empty state shown when no results.

- [x] T021 [US3] Add `purpose` select filter (FOR_APPROVAL / FOR_INFORMATION / FOR_REVIEW / OTHER) and verify pagination + search in `frontend/app/(dashboard)/transmittals/page.tsx`

---

## Phase 6 — US4: EC-RFA-004 Submit Validation (P2)

> **Story Goal**: Doc Control blocked from submitting Transmittal with DRAFT items; 422 error clearly identifies the offending document.
> **Independent Test**: Create Transmittal with DRAFT item → submit → expect 422 with offending doc number in error message; item highlighted in UI.

- [x] T022 [US4] Verify UI shows 422 error from `POST /transmittals/:uuid/submit` with item-level identification — display `userMessage` from ADR-007 error response in `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`

---

## Phase 7 — US5: Circulation Edge Cases — Re-assign & Force Close (P2)

> **Story Goal**: Doc Control can re-assign deactivated assignee (EC-CIRC-001) and force-close stuck Circulation with mandatory reason (EC-CIRC-002).
> **Independent Test**: Deactivate assignee in OPEN Circulation → Re-assign button visible. Force-close with reason → status CANCELLED, reason in audit log.

- [x] T023 [US5] Add Re-assign UI — show "Re-assign" action button for deactivated assignee routings; open modal with user search; calls `PATCH /:uuid/routing/:routingId/reassign` in `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`

- [x] T024 [US5] Add Force Close UI — "Force Close" button (Document Control only); modal requires mandatory reason field; calls `POST /:uuid/force-close`; invalidate `['circulation', uuid]` query on success in `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`

---

## Phase 8 — Tests (Tier 2 — required before merge)

- [x] T025 Unit test `TransmittalService.submit()` — throws `ValidationException` (422) when any item correspondence is DRAFT; passes when all items are SUBMITTED/APPROVED in `backend/src/modules/transmittal/transmittal.service.spec.ts`

- [x] T026 Unit test `CirculationService.reassignRouting()` — permission check throws 403 for non-Document Control; updates `routing.assignedTo` correctly in `backend/src/modules/circulation/circulation.service.spec.ts`

- [x] T027 Unit test `CirculationService.forceClose()` — all PENDING routings set to CANCELLED in single transaction; mandatory reason logged; BullMQ `notification-queue` job enqueued post-commit (verify with mock queue) in `backend/src/modules/circulation/circulation.service.spec.ts`

- [ ] T028 Unit test `CirculationService.findOneByUuid()` — `isOverdue: boolean` computed correctly via server-side logic with mocked `Date` (or injected `ClockService`): `true` when `now > deadline + 1 day`, `false` when `now <= deadline + 1 day`, `false` when `deadline` is null (SC-007) in `backend/src/modules/circulation/circulation.service.spec.ts`

- [ ] T029 Unit test `CirculationService.close()` — throws 403 for non-Document Control; throws 422 when any Main/Action routing is not COMPLETED; succeeds and sets status to CLOSED when all COMPLETED in `backend/src/modules/circulation/circulation.service.spec.ts`

- [ ] T030 Unit test EC-CORR-001 — `CorrespondenceService.cancel()` enqueues BullMQ notification job per affected assignee; payload includes `circulationNo`, `correspondenceNo`, `cancellationReason`; audit log written in `backend/src/modules/correspondence/correspondence.service.spec.ts`

- [ ] T031 Integration test `CirculationService.forceClose()` with 50 routings — total transaction time ≤ 3 seconds (SC-008); use bulk UPDATE query not loop in `backend/src/modules/circulation/circulation.service.spec.ts`

- [ ] T032 Frontend unit test — Overdue badge renders when `routing.isOverdue === true` (no client-side date math); badge absent when `routing.isOverdue === false`; snapshot test for both states in `frontend/app/(dashboard)/circulation/[uuid]/__tests__/page.test.tsx`

- [ ] T033 Frontend unit test — "Close Circulation" button visible for `DOCUMENT_CONTROL` role only; hidden for `SUPERVISOR`, `ASSIGNEE`, `VIEWER` roles in `frontend/app/(dashboard)/circulation/[uuid]/__tests__/page.test.tsx`

---

## Phase 9 — i18n Polish (Guidelines)

- [ ] T034 [P] Add Thai i18n keys for force-close modal, close action, overdue badge, EC-CORR-001 notification in `frontend/public/locales/th/circulation.json` — keys: `circulation.forceClose.title`, `circulation.forceClose.reason`, `circulation.close.confirm`, `circulation.overdue`, `circulation.notification.cancelledByCorrespondence`

- [ ] T035 [P] Add English i18n keys matching Thai keys above in `frontend/public/locales/en/circulation.json`

---

## Phase 10 — Transmittal Revision Refactor (v1.8.8 — Based on Clarifications 2026-04-29)

> **Goal**: Restructure Transmittal to follow Master-Revision Pattern (like RFA/Correspondence).

- [ ] T036 Schema: Add `revision_id INT NULL` with FK to `correspondence_revisions(id)` + index to `transmittal_items`; add `item_type VARCHAR(50) NULL` column (ADR-009 direct SQL) in `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`

- [ ] T037 Update `TransmittalItem` entity — add nullable `revisionId` column + `@ManyToOne` relation to `CorrespondenceRevision`; add `itemType?: string` column in `backend/src/modules/transmittal/entities/transmittal-item.entity.ts`

- [ ] T038 Update `TransmittalService.findOneByUuid()` — join `correspondence_revisions`, read `purpose`/`remarks` from `details` JSON; include `revisionId`, `revisionNumber`, `revisionLabel` in response in `backend/src/modules/transmittal/transmittal.service.ts`

- [ ] T039 Add `TransmittalService.copyItemsToRevision(oldRevisionId, newRevisionId)` helper — bulk clone `transmittal_items` rows in single atomic transaction in `backend/src/modules/transmittal/transmittal.service.ts`

- [ ] T040 Add `TransmittalService.createRevision(uuid, user)` — create `correspondence_revisions` record; auto-copy all items via `copyItemsToRevision()` in `backend/src/modules/transmittal/transmittal.service.ts`

- [ ] T041 Add `POST /:uuid/revisions` endpoint with `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` + `@Audit('transmittal.create-revision', 'transmittal')`; returns `{ revisionId, revisionNumber, revisionLabel }` in `backend/src/modules/transmittal/transmittal.controller.ts`

- [ ] T042 Update `TransmittalService.submit()` — EC-RFA-004 checks current revision items only; workflow instance binds to `correspondence_revisions.publicId` (UUID string, ADR-019 — NOT revision.id INT) in `backend/src/modules/transmittal/transmittal.service.ts`

- [ ] T043 Update `TransmittalService.create()` — write `purpose`/`remarks` to `CorrespondenceRevision.details` JSON; replace hardcoded `ORG_CODE: 'ORG'` with real org lookup (`organizationCode` from `Organization` entity, pattern: `correspondence.service.ts:263-269`); save `itemType` from DTO in `backend/src/modules/transmittal/transmittal.service.ts`

- [ ] T044 Schema: Drop `purpose` and `remarks` from `transmittals` table (ADR-009 direct SQL — deploy AFTER T043 is live); remove corresponding TypeORM columns from entity in `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql` + `backend/src/modules/transmittal/transmittal.entity.ts`

- [ ] T045 Fix `TransmittalItemDto.itemId` — change `itemId: number` + `@IsInt()` → `itemId: string` + `@IsUUID()`; resolve UUID→INT via `uuidResolver.resolveCorrespondenceId()` in service (ADR-019 CRITICAL) in `backend/src/modules/transmittal/dto/create-transmittal.dto.ts` + `backend/src/modules/transmittal/transmittal.service.ts`

- [ ] T046 [P] Add revision fields to frontend types — `revisionId?: string`, `revisionNumber?: number`, `revisionLabel?: string` to `Transmittal`; `revisionId?: string` to `TransmittalItem`; update `useTransmittal(uuid, revisionId?)` hook in `frontend/types/transmittal.ts` + `frontend/hooks/use-transmittal.ts`

- [ ] T047 Add revision selector to Transmittal detail page — dropdown when multiple revisions exist (pattern: RFA detail page); display `revisionLabel` (A, B, C) in `IntegratedBanner` in `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`

- [ ] T048 ADR-019 compliance scan — verify all revision-related fields use `publicId` (string UUID) not `id` (INT) in both backend responses and frontend types; run `grep -rn "parseInt\|Number(\|\.id[^a-zA-Z]"` on new code in `backend/src/modules/transmittal/` + `frontend/types/transmittal.ts`

---

## Dependency Graph

```
Phase 1 (Backend Foundation):
  T001 → T002 [P], T006 [P]  (workflow instance join)
  T001 → T004 → T005         (submit + EC-RFA-004)
  T007 [P], T008 [P]         (reassign + force-close — parallel)
  T009 → T011                (close Circulation — Document Control only)
  T012                       (EC-CORR-001 cascade — no Phase 1 deps)

Phase 2 (Types & Hooks):
  T013 [P], T014 [P]         (types — parallel, no Phase 1 deps)
  T013 → T015                (useTransmittal hook)
  T014 → T016                (useCirculation hook)

Phase 3 (US1 — Transmittal Detail):
  T015, T002 → T017

Phase 4 (US2 — Circulation Detail):
  T016, T006, T009, T011 → T018, T019, T020

Phase 5 (US3 — List):
  T013, T003 → T021

Phase 6 (US4 — EC-RFA-004 UI):
  T005, T017 → T022

Phase 7 (US5 — EC-CIRC-001/002):
  T007, T008, T018 → T023, T024

Phase 8 (Tests):
  T004 → T025
  T007 → T026
  T008 → T027
  T006 → T028
  T009 → T029
  T012 → T030
  T008, T031 (integration — 50 routings ≤3s)
  T019 → T032
  T020 → T033

Phase 10 (Revision Refactor):
  T036 → T037 → T038 → T039, T040 → T041
  T038 → T042 (submit revision-scoped)
  T038 → T043 (create writes to details JSON)
  T043 deployed → T044 (drop columns)
  T045 (UUID fix — parallel)
  T046 [P] → T047
  T038, T046 → T048 (ADR-019 scan)
```

---

## Parallel Execution Opportunities

| Group | Tasks | Condition |
|---|---|---|
| Backend foundation | T002, T003, T006, T007, T008, T012 | All start after T001 |
| Types | T013, T014 | Immediately (no Phase 1 deps) |
| Hooks | T015, T016 | After respective types |
| Detail pages | T017, T018 | After hooks + backend |
| Tests | T025–T031 | After their respective service methods |
| i18n | T034, T035 | After Phase 4 UI complete |
| Revision types | T046 | Parallel with schema (T036) |

---

## Implementation Strategy (MVP → Full)

| Scope | Tasks | Deliverable |
|---|---|---|
| **MVP** (US1 + US2 core) | T001–T009, T013–T020 | Both detail pages live with workflow data |
| **P1 Complete** | + T021, T022 | List page + submit validation |
| **P2 Complete** | + T023, T024, T028–T033 | EC edge cases + all tests |
| **Full** | + T034–T048 | i18n polish + Revision Refactor |

---

## Commit Message Convention

```
feat(workflow-engine): add getInstanceByEntity() for Transmittal+Circulation join
feat(transmittal): expose workflowInstanceId via entity_type join in findOneByUuid
feat(transmittal): add submit endpoint with EC-RFA-004 DRAFT item validation
feat(circulation): expose workflowInstanceId + server-side isOverdue in findOneByUuid
feat(circulation): add reassignRouting EC-CIRC-001 handler with CASL guard
feat(circulation): add forceClose EC-CIRC-002 — single transaction + BullMQ post-commit
feat(circulation): add close endpoint — Document Control only (FR-C09)
feat(correspondence): add EC-CORR-001 cascade — force-close Circulations + BullMQ notify (FR-X05)
feat(frontend): wire WorkflowLifecycle in transmittal detail page (US1)
feat(frontend): wire WorkflowLifecycle + server-side overdue badge in circulation detail (US2)
feat(frontend): add Close Circulation button — Document Control role guard (FR-C09)
test(circulation): isOverdue server-side unit test with mocked Date (SC-007)
test(circulation): close() RBAC + pre-condition unit tests
test(circulation): forceClose integration test ≤3s / 50 routings (SC-008)
test(correspondence): EC-CORR-001 BullMQ notification enqueue test
feat(schema): add revision_id + item_type to transmittal_items (ADR-009)
fix(transmittal): TransmittalItemDto.itemId INT→UUID string (ADR-019)
fix(transmittal): replace hardcoded ORG_CODE with real organizationCode lookup
```

---

## Security Verification Checklist

- [ ] `ability.can('reassign', 'Circulation')` — 403 for non-Document Control (T007)
- [ ] `ability.can('forceClose', 'Circulation')` — 403 for non-Document Control (T008)
- [ ] `ability.can('close', 'Circulation')` — 403 for all non-Document Control roles (T009)
- [ ] Close Circulation pre-condition: 422 if any Main/Action routing not COMPLETED (T009)
- [ ] `Idempotency-Key` header enforced on all workflow transitions
- [ ] `workflowInstanceId` is `string` (UUID) — never `number` in any response (ADR-019)
- [ ] EC-CORR-001 notification is BullMQ job — NOT inline in request thread (ADR-008)
- [ ] Frontend `isOverdue` from backend field only — no `new Date()` comparison in JSX (T019)
- [ ] No `parseInt` / `Number()` / `+` on any UUID in new code (ADR-019)
- [ ] Two-phase file upload via `StorageService` for any new file operations (ADR-016)
