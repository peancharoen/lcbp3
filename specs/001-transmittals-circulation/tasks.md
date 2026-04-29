# Tasks: Transmittals + Circulation Complete Integration (v1.8.8 with Revision Refactor)

**Branch**: `001-transmittals-circulation` | **Total Tasks**: 36 (18 v1.8.7 + 18 v1.8.8 Phase 4) | **Phase**: Phase 4 Ready — Revision Refactor

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

---

## Phase 4 — Transmittal Revision Refactor (v1.8.8)

**Based on**: Clarifications Session 2026-04-29
**Goal**: Restructure Transmittal to follow Master-Revision Pattern

### R1 — Schema: Add `revision_id` to `transmittal_items`
- **File**: `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`
- **Action**: Add `revision_id INT NULL` column with FK to `correspondence_revisions(id)`, create index per ADR-009
- **Dependencies**: none
- **Status**: [ ]

### R2 — Backend Entity: Update `TransmittalItem` with `revisionId`
- **File**: `backend/src/modules/transmittal/entities/transmittal-item.entity.ts`
- **Action**: Add `revisionId` column (nullable), add `@ManyToOne` relation to `CorrespondenceRevision`
- **Dependencies**: R1
- **Status**: [ ]

### R3 — Backend Service: Update `findOneByUuid` to read from revision
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Join `correspondence_revisions`, read `purpose`/`remarks` from `details` JSON field; include `revisionId`, `revisionNumber`, `revisionLabel` in response
- **Dependencies**: R2
- **Status**: [ ]

### R4 — Backend Service: Add `createRevision()` method
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Create new `correspondence_revisions` record, copy all items from current revision to new revision via `copyItemsToRevision()` helper
- **Dependencies**: R3
- **Status**: [ ]

### R5 — Backend Service: Add `copyItemsToRevision()` helper
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Clone all `transmittal_items` where `revision_id = oldRevisionId`, insert new records with `revision_id = newRevisionId`. **Success Criteria**: (1) Item count in new revision equals old revision, (2) All `quantity` values preserved, (3) `item_correspondence_id` FK constraints pass, (4) Atomic transaction (rollback on failure).
- **Dependencies**: R2
- **Status**: [ ]

### R6 — Backend Controller: Add `POST /:uuid/revisions` endpoint
- **File**: `backend/src/modules/transmittal/transmittal.controller.ts`
- **Action**: New endpoint with `@RequirePermission('document.manage')` (ADR-016), `@Audit('transmittal.create-revision', 'transmittal')`, calls `createRevision()`, returns `{ revisionId, revisionNumber, revisionLabel }`
- **Dependencies**: R4
- **Status**: [ ]
- **Security**: CASL Guard required — Document Control role or above

### R7 — Backend Service: Update `submit()` for revision-scoped items
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: EC-RFA-004 validation checks items for current revision only; workflow instance binds to `correspondence_revisions.id`
- **Dependencies**: R3, R4
- **Status**: [ ]

### R8 — Frontend Types: Add revision fields to `Transmittal`
- **File**: `frontend/types/transmittal.ts`
- **Action**: Add `revisionId?: string`, `revisionNumber?: number`, `revisionLabel?: string` to `Transmittal` interface
- **Dependencies**: none (parallel)
- **Status**: [ ]

### R9 — Frontend Types: Add `revisionId` to `TransmittalItem`
- **File**: `frontend/types/transmittal.ts`
- **Action**: Add `revisionId?: string` to `TransmittalItem` interface
- **Dependencies**: R8
- **Status**: [ ]

### R10 — Frontend Page: Add revision selector to detail page
- **File**: `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`
- **Action**: Show revision dropdown when multiple revisions exist (like RFA pattern), display `revisionLabel` (A, B, C) in banner
- **Dependencies**: R8, R9
- **Status**: [ ]

### R11 — Frontend Hook: Update `useTransmittal` for revision context
- **File**: `frontend/hooks/use-transmittal.ts`
- **Action**: Add optional `revisionId` parameter to fetch specific revision; default to current revision
- **Dependencies**: R8
- **Status**: [ ]

### R12 — Workflow Engine: Update `getInstanceByEntity` for revision binding (ADR-019)
- **File**: `backend/src/modules/workflow-engine/workflow-engine.service.ts`
- **Action**: Support `entity_type='transmittal'` with `entity_id=revision.publicId` (UUID string, NOT revision.id INT). Ensure workflow instance stores and retrieves using UUIDv7 string per ADR-019.
- **Dependencies**: R3
- **Status**: [ ]
- **ADR-019 Check**: Use `revision.publicId` (string) — never `revision.id` (INT) for entity binding

### R14 — Backend Service: Update `create()` to write `purpose`/`remarks` to `details` JSON
- **File**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: In `create()`, stop writing `purpose`/`remarks` to `Transmittal` entity; instead store them in `CorrespondenceRevision.details = { purpose, remarks }` JSON field. Remove `purpose`/`remarks` from `queryRunner.manager.create(Transmittal, {...})` call.
- **Dependencies**: R3 (findOneByUuid reads from details)
- **Status**: [ ]
- **Note**: Must deploy BEFORE step 3 SQL (DROP COLUMN) in schema-02-tables.sql

### R15 — Schema: Drop `purpose` and `remarks` from `transmittals` table
- **File**: `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`
- **Action**: `ALTER TABLE transmittals DROP COLUMN purpose, DROP COLUMN remarks;` per ADR-009. Also remove corresponding TypeORM columns from `transmittal.entity.ts`.
- **Dependencies**: R14 (must be fully deployed first)
- **Status**: [ ]
- **ADR-009**: Direct SQL only — no TypeORM migration file

### R16 — DTO: Fix `TransmittalItemDto.itemId` to UUID (ADR-019)
- **File**: `backend/src/modules/transmittal/dto/create-transmittal.dto.ts` + `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Change `itemId: number` + `@IsInt()` → `itemId: string` + `@IsUUID()`. In `create()`, replace direct assignment with `uuidResolver.resolveCorrespondenceId(item.itemId)` before saving `itemCorrespondenceId`.
- **Dependencies**: R1 (schema must be stable)
- **Status**: [ ]
- **ADR-019**: CRITICAL — Frontend must send `publicId` (UUID string), not INT id

### R17 — Schema + Entity: Add `itemType` column to `transmittal_items` (H1)
- **Files**: `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql` + `backend/src/modules/transmittal/entities/transmittal-item.entity.ts` + `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: (1) SQL: `ALTER TABLE transmittal_items ADD COLUMN item_type VARCHAR(50) NULL COMMENT 'ประเภทเอกสาร เช่น DRAWING, RFA, CORRESPONDENCE' AFTER item_correspondence_id;` (ADR-009). (2) Entity: add `@Column({ name: 'item_type', nullable: true }) itemType?: string;`. (3) Service `create()`: save `itemType: item.itemType` from DTO (field already exists in `TransmittalItemDto`).
- **Dependencies**: R1
- **Status**: [ ]
- **Note**: Fixes H1 — DTO had `itemType` but it was never persisted to DB

### R18 — Service: Fix `ORG_CODE` hardcode in `create()` (M1)
- **Files**: `backend/src/modules/transmittal/transmittal.service.ts`
- **Action**: Before `generateNextNumber()`, fetch originator org: `const originatorOrg = await this.dataSource.manager.findOne(Organization, { where: { id: userOrgId } }); const orgCode = originatorOrg?.organizationCode ?? 'UNK';` — then replace `ORG_CODE: 'ORG'` with `ORG_CODE: orgCode`. Pattern matches `correspondence.service.ts` line 263-269.
- **Dependencies**: none (parallel)
- **Status**: [ ]
- **Note**: Fixes M1 — `Organization.organizationCode` field confirmed at `organization.entity.ts:24`

### R13 — Validation: ADR-019 UUID Compliance Check
- **File**: `backend/src/modules/transmittal/` + `frontend/types/transmittal.ts`
- **Action**: Verify all revision-related fields use `publicId` (string UUID) not `id` (INT): `revisionId`, `workflowInstanceId`, `transmittalId` in responses. Run `grep -n "parseInt\|Number(\|\.id[^a-zA-Z]"` to catch violations.
- **Dependencies**: R2, R3, R12
- **Status**: [ ]
- **ADR-019**: CRITICAL — Zero tolerance for INT ID exposure in API responses

---

## Phase 4 Execution Order

```
R1 (schema)
  → R2 (entity)
    → R3 (service findOneByUuid) ─┬→ R4 (createRevision) → R6 (controller endpoint)
                                  │    → R5 (copyItems helper)
                                  ├→ R7 (submit update)
                                  ├→ R12 (workflow binding update)
                                  └→ R13 (ADR-019 validation)
R8 (frontend types) ─┬→ R9 (item types)
  → R11 (hook update)  │
  → R10 (page update) ─┘
R3 → R14 (create() writes to details JSON)
  → R15 (DROP COLUMN purpose/remarks) ← deploy R14 first
R1 → R17 (add item_type column + entity + save in create())
R18 (fix ORG_CODE — no dependencies, parallel safe)
```

---

## Phase 4 Commit Message Convention

```
feat(schema): add revision_id to transmittal_items table (ADR-009)
feat(transmittal): add revisionId column to TransmittalItem entity
feat(transmittal): update findOneByUuid to read from correspondence_revisions
feat(transmittal): add createRevision with automatic item copying
feat(transmittal): add copyItemsToRevision helper method
feat(transmittal): add POST /:uuid/revisions endpoint
feat(transmittal): update submit for revision-scoped items (EC-RFA-004)
feat(frontend): add revision fields to Transmittal types
feat(frontend): add revision selector to transmittal detail page
feat(workflow-engine): update getInstanceByEntity for revision binding
chore(validation): ADR-019 UUID compliance check for revision refactor
fix(transmittal): change TransmittalItemDto.itemId from INT to UUID string (ADR-019)
feat(transmittal): add item_type column to transmittal_items and persist from DTO (H1)
fix(transmittal): replace hardcoded ORG_CODE with real organizationCode lookup (M1)
```
