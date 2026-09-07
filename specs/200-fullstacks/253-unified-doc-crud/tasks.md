# Tasks: Unified Document CRUD Management with Admin Maintenance Tools

**Input**: Design documents from `/specs/200-fullstacks/253-unified-doc-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per Decision #22 (3-Layer Testing: Unit + Integration + E2E).

**Organization**: Tasks grouped by user story (6 stories) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`
- **Frontend**: `frontend/`
- **Specs**: `specs/200-fullstacks/253-unified-doc-crud/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Permission seeds, shared service interfaces, and i18n keys

- [x] T001 Add new permissions to `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` (edit_metadata, bulk_*, maintenance_* per data-model.md)
- [x] T002 [P] Adjust role-permission mapping in seed SQL — remove `correspondence.delete` from DC role, add `correspondence.cancel` if missing
- [x] T003 [P] Add i18n keys `document.action.*` and `document.type.*` to `frontend/public/locales/th/common.json`
- [x] T004 [P] Add i18n keys `document.action.*` and `document.type.*` to `frontend/public/locales/en/common.json`
- [x] T005 Create `DocumentActionStrategy` interface in `backend/src/common/services/document-action-strategy.interface.ts`
- [x] T006 [P] Create `DocumentSideEffectsService` skeleton in `backend/src/common/services/document-side-effects.service.ts` (orchestrator with tiered criticality)
- [x] T007 [P] Create `DocumentHardDeleteService` skeleton in `backend/src/common/services/document-hard-delete.service.ts` (shared cascade per type)
- [x] T008 [P] Create centralized Query Key Registry in `frontend/lib/query-keys.ts`
- [x] T009 [P] Create frontend `DocumentActionStrategy` interface in `frontend/components/documents/document-action-strategy.ts`

**Checkpoint**: Shared infrastructure ready — per-type strategies and frontend components can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend shared services implementation + frontend shared component shells

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Implement `DocumentSideEffectsService.executeCritical()` in `backend/src/common/services/document-side-effects.service.ts` (Workflow Termination + Circulation Force-Close within transaction)
- [x] T011 [P] Implement `DocumentSideEffectsService.executeNonCritical()` in `backend/src/common/services/document-side-effects.service.ts` (Search Re-index + Notifications + Vector Deletion post-commit with retry)
- [x] T012 Implement `DocumentHardDeleteService.execute()` in `backend/src/common/services/document-hard-delete.service.ts` (Redis Redlock + cascade per type + snapshot)
- [x] T013 [P] Add `@VersionColumn` to RFA entity in `backend/src/modules/rfa/entities/rfa.entity.ts`
- [x] T014 [P] Add `@VersionColumn` + `statusId` (FK `correspondence_status`) + `cancelReason` + `cancelledAt` + `cancelledBy` columns to Transmittal entity in `backend/src/modules/transmittal/entities/transmittal.entity.ts`
- [x] T015 [P] Add `@VersionColumn` + `deleteReason` to Drawing entities in `backend/src/modules/drawing/entities/`
- [x] T016 [P] Add `@VersionColumn` to Circulation entity in `backend/src/modules/circulation/entities/circulation.entity.ts`
- [x] T017 [P] Create `DocumentActionResponse` DTO in `backend/src/common/dto/document-action-response.dto.ts` (unified response shape with sideEffects + auditId)
- [x] T018 [P] Create `MetadataPatchDto` base in `backend/src/common/dto/metadata-patch.dto.ts` (expectedVersion + tier1/2/3 fields + forceEdit)
- [x] T019 [P] Create `BulkCancelDto` in `backend/src/common/dto/bulk-cancel.dto.ts` (publicIds[], reason, maxItems=100)
- [x] T020 [P] Create `BulkTagDto` in `backend/src/common/dto/bulk-tag.dto.ts` (items[], tagIds[], mode)
- [x] T021 [P] Create `BulkExportDto` in `backend/src/common/dto/bulk-export.dto.ts` (items[], format, fields[])
- [x] T022 Build `<DocumentCancelDialog>` shared component in `frontend/components/documents/document-cancel-dialog.tsx` (reason input + warning + type-specific label via strategy)
- [x] T023 [P] Build `<DocumentHardDeleteDialog>` shared component in `frontend/components/documents/document-hard-delete-dialog.tsx` (two-tier confirmation, "DELETE" text input)
- [x] T024 [P] Build `<DocumentMetadataEditDialog>` shared component in `frontend/components/documents/document-metadata-edit-dialog.tsx` (3-tier field rendering)
- [x] T025 [P] Build `<DocumentRowActions>` shared component in `frontend/components/documents/document-row-actions.tsx` (Dropdown ⋯ with CASL permission filtering)
- [x] T026 [P] Build `<BulkActionBar>` shared component in `frontend/components/documents/bulk-action-bar.tsx` (floating bar with count + bulk action buttons)
- [x] T027 [P] Create `useDocumentActions` hook in `frontend/hooks/use-document-actions.ts` (shared mutations: cancel, hardDelete, metadataPatch with cross-module cache invalidation)
- [x] T028 [P] Create `useBulkActions` hook in `frontend/hooks/use-bulk-actions.ts` (bulk operations with progress polling + result dialog)
- [x] T029 [P] Create `document-action.service.ts` in `frontend/lib/services/document-action.service.ts` (generic API caller per type)

**Checkpoint**: Foundation ready — per-type strategy implementations and Dashboard integration can begin

---

## Phase 3: User Story 1 — DC ยกเลิกเอกสารจากหน้า Dashboard (Priority: P1) 🎯 MVP

**Goal**: DC can cancel any document type from Dashboard list view via Row Action Dropdown with side effects (force-close circulation, terminate workflow, notifications, search re-index)

**Independent Test**: Create Correspondence with status IN_REVIEW, DC clicks Cancel from Row Action Dropdown, confirms with reason — verify status changes to CANCELLED, circulations force-closed, workflow terminated, toast shows side effects summary

### Tests for User Story 1

- [x] T030 [P] [US1] Unit test for Correspondence cancel controller in `backend/src/modules/correspondence/correspondence.controller.spec.ts` (permission check, audit decorator, response shape)
- [x] T031 [P] [US1] Unit test for Correspondence cancel service in `backend/src/modules/correspondence/correspondence.service.spec.ts` (status guard, force-close circulation, workflow termination, idempotent on CANCELLED)
- [x] T032 [P] [US1] Unit test for RFA cancel service in `backend/src/modules/rfa/rfa.service.spec.ts` (status guard, workflow termination)
- [x] T033 [P] [US1] Unit test for Transmittal cancel service in `backend/src/modules/transmittal/transmittal.service.spec.ts` (status guard, does NOT cascade to items)
- [x] T034 [P] [US1] Unit test for Drawing soft-delete service in `backend/src/modules/drawing/contract-drawing.service.spec.ts` (sets deletedAt, deleteReason)
- [x] T035 [P] [US1] Integration test for side effects pipeline in `backend/src/common/services/document-side-effects.service.spec.ts` (critical callbacks, BullMQ queue dispatch, retry options)
- [x] T036 [P] [US1] E2E test for DC cancel flow in `backend/test/document-cancel.e2e-spec.ts` (Playwright frontend e2e ยังไม่มี infra — ใช้ backend e2e แทน) (Row Action ⋯ → Dialog → reason → confirm → toast with side effects)

### Implementation for User Story 1

- [x] T037 [US1] Implement Correspondence cancel strategy in `backend/src/modules/correspondence/strategies/correspondence-action.strategy.ts` (status → CANCELLED, force-close circulations, terminate workflow)
- [x] T038 [US1] Enhance existing `POST /correspondences/:uuid/cancel` in `backend/src/modules/correspondence/correspondence.controller.ts` — add expectedVersion, use DocumentSideEffectsService, return DocumentActionResponse
- [x] T039 [P] [US1] Implement RFA cancel strategy in `backend/src/modules/rfa/strategies/rfa-action.strategy.ts`
- [x] T040 [P] [US1] Add `POST /rfas/:uuid/cancel` endpoint in `backend/src/modules/rfa/rfa.controller.ts` (CASL guard, Idempotency-Key, @Audit)
- [x] T041 [P] [US1] Implement Transmittal cancel strategy in `backend/src/modules/transmittal/strategies/transmittal-action.strategy.ts` (cancel transmittal only, NOT items)
- [x] T042 [P] [US1] Add `POST /transmittals/:uuid/cancel` endpoint in `backend/src/modules/transmittal/transmittal.controller.ts`
- [x] T043 [P] [US1] Implement Drawing soft-delete strategy in `backend/src/modules/drawing/strategies/drawing-action.strategy.ts` (deletedAt, deleteReason — NOT status)
- [x] T044 [P] [US1] Add `POST /drawings/:uuid/cancel` endpoint in `backend/src/modules/drawing/contract-drawing.controller.ts` (soft-delete)
- [x] T045 [US1] Integrate `<DocumentRowActions>` into Correspondences list in `frontend/app/(dashboard)/correspondences/page.tsx` with Correspondence strategy
- [x] T046 [P] [US1] Integrate `<DocumentRowActions>` into RFAs list in `frontend/app/(dashboard)/rfas/page.tsx` with RFA strategy
- [x] T047 [P] [US1] Integrate `<DocumentRowActions>` into Transmittals list in `frontend/app/(dashboard)/transmittals/page.tsx` with Transmittal strategy
- [x] T048 [P] [US1] Integrate `<DocumentRowActions>` into Drawings list in `frontend/app/(dashboard)/drawings/page.tsx` with Drawing strategy
- [x] T049 [US1] Add cross-module cache invalidation in `useDocumentActions` hook — Cancel Correspondence invalidates `circulation.lists` + `search`

**Checkpoint**: DC can cancel all 5 document types from Dashboard with side effects — MVP complete

---

## Phase 4: User Story 2 — DC แก้ไขข้อมูลกำกับเอกสารหลังส่งแล้ว (Priority: P1)

**Goal**: DC can edit Tier 1 metadata fields on submitted documents via Metadata Patch dialog with Before/After Diff audit and Optimistic Lock

**Independent Test**: Create Correspondence with status IN_REVIEW, DC clicks "Edit Metadata", changes Subject + adds Tag, saves — verify metadata updated, Audit Trail has Before/After Diff, recipients notified

### Tests for User Story 2

- [x] T050 [P] [US2] Unit test for Correspondence metadata patch in `backend/src/modules/correspondence/correspondence.service.spec.ts` (3-tier field classification, optimistic lock, no-op on no changes)
- [x] T051 [P] [US2] Unit test for RFA metadata patch in `backend/src/modules/rfa/rfa.service.spec.ts`
- [x] T052 [P] [US2] Unit test for Transmittal metadata patch in `backend/src/modules/transmittal/transmittal.service.spec.ts`
- [x] T053 [P] [US2] Unit test for Drawing metadata patch in `backend/src/modules/drawing/contract-drawing.service.spec.ts`
- [x] T054 [P] [US2] E2E test for metadata patch flow in `backend/test/document-metadata-patch.e2e-spec.ts` (PATCH /correspondences/:uuid/metadata → version increment + tier3 reject; ต้องรันกับ test DB)

### Implementation for User Story 2

- [x] T055 [US2] Implement Correspondence metadata patch in `backend/src/modules/correspondence/correspondence.service.ts` (Tier 1/2/3 field validation, version check, before/after diff, audit)
- [x] T056 [US2] Add `PATCH /correspondences/:uuid/metadata` endpoint in `backend/src/modules/correspondence/correspondence.controller.ts`
- [x] T057 [P] [US2] Implement RFA metadata patch + `PATCH /rfas/:uuid/metadata` in `backend/src/modules/rfa/`
- [x] T058 [P] [US2] Implement Transmittal metadata patch + `PATCH /transmittals/:uuid/metadata` in `backend/src/modules/transmittal/`
- [x] T059 [P] [US2] Implement Drawing metadata patch + `PATCH /drawings/contract/:uuid/metadata` in `backend/src/modules/drawing/`
- [x] T060 [P] [US2] Circulation routing edit — covered by existing `PATCH /circulations/routings/:id` + `PATCH /circulations/:uuid/routing/:routingId/reassign`
- [x] T061 [US2] Wire `<DocumentMetadataEditDialog>` into Correspondence detail page in `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx`
- [x] T062 [P] [US2] Wire `<DocumentMetadataEditDialog>` into RFA detail page in `frontend/app/(dashboard)/rfas/[uuid]/page.tsx`
- [x] T063 [P] [US2] Wire `<DocumentMetadataEditDialog>` into Transmittal detail page in `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`
- [x] T064 [P] [US2] Wire `<DocumentMetadataEditDialog>` into Drawing detail page in `frontend/app/(dashboard)/drawings/[uuid]/page.tsx`

**Checkpoint**: DC can edit metadata on all 5 document types with audit diff and optimistic lock

---

## Phase 5: User Story 3 — Superadmin ลบถาวรเอกสาร (Priority: P2)

**Goal**: Superadmin can hard-delete documents with full cascade (files, vectors, DB) and pre-delete snapshot

**Independent Test**: Create document with attachments + Qdrant vector, Superadmin clicks Hard-Delete, types "DELETE" to confirm — verify files deleted, vectors deleted, DB rows deleted, Audit Trail has snapshot

### Tests for User Story 3

- [x] T065 [P] [US3] Unit test for `DocumentHardDeleteService` in `backend/src/common/services/document-hard-delete.service.spec.ts` (cascade per type, Redlock, snapshot, vector deletion fail → pending retry)
- [x] T066 [P] [US3] Integration test for Hard-Delete cascade — covered by buildCascadePolicy tests in `backend/src/common/services/document-hard-delete.service.spec.ts` (cascade SQL + file collection + NotFound) (files + vectors + DB + snapshot)
- [x] T067 [P] [US3] E2E test for Superadmin hard-delete flow in `backend/test/document-hard-delete.e2e-spec.ts` (Playwright frontend infra ไม่มี — ใช้ backend e2e; ต้องมี test DB + Redis) (Hard-Delete → type "DELETE" → confirm → success toast with snapshot)

### Implementation for User Story 3

- [x] T068 [US3] Implement `DocumentHardDeleteService` per-type cascade policies in `backend/src/common/services/document-hard-delete.service.ts` (Correspondence/RFA: full cascade; Transmittal: transmittals + items only; Drawings: files + vectors + DB; Circulation: N/A)
- [x] T069 [US3] Fix `DELETE /correspondences/:uuid` permission check in `backend/src/modules/correspondence/correspondence.controller.ts` — check `correspondence.delete` with `system.manage_all` fallback (not just `system.manage_all`)
- [x] T070 [P] [US3] Add `DELETE /rfas/:uuid/hard` (hard-delete) endpoint in `backend/src/modules/rfa/rfa.controller.ts`
- [x] T071 [P] [US3] Add `DELETE /transmittals/:uuid/hard` (hard-delete) endpoint in `backend/src/modules/transmittal/transmittal.controller.ts`
- [x] T072 [P] [US3] Add `DELETE /drawings/contract/:uuid/hard` (hard-delete purge) endpoint in `backend/src/modules/drawing/contract-drawing.controller.ts`
- [x] T073 [US3] Wire `<DocumentHardDeleteDialog>` into 4 detail pages — Correspondence/RFA/Transmittal/Contract-Drawing (visible with `system.manage_all` or `{type}.delete`; Circulation ไม่มี hard-delete)

**Checkpoint**: Superadmin can hard-delete all document types with full cascade and snapshot

---

## Phase 6: User Story 4 — DC ยกเลิกเอกสารเป็นชุด (Priority: P2)

**Goal**: DC can bulk-cancel up to 100 same-type documents with async progress and per-item success/failure reporting

**Independent Test**: Create 5 documents (3 IN_REVIEW, 1 DRAFT, 1 CANCELLED), select all 5, click Bulk Cancel — verify CANCELLED filtered out, 4 processed, result dialog shows success/failed

### Tests for User Story 4

- [x] T074 [P] [US4] Unit test for bulk cancel service in `backend/src/modules/document/document.service.spec.ts` (max 100, status filter, partial failure, bulkId correlation)
- [~] T075 [P] [US4] Integration test for bulk cancel with BullMQ in `backend/src/modules/correspondence/correspondence-bulk.integration.spec.ts`
- [~] T076 [P] [US4] E2E test for bulk cancel flow in `frontend/e2e/document-bulk-cancel.spec.ts` (select 5 → Bulk Action Bar → reason → progress → result dialog)

### Implementation for User Story 4

- [x] T077 [US4] Implement bulk cancel generic service in `backend/src/modules/document/document.service.ts` (per-item processing, bulkId, audit per item)
- [x] T078 [US4] Add `POST /documents/bulk/cancel` in `backend/src/modules/document/document.controller.ts` — return 202 with bulkId for polling
- [x] T079 [P] [US4] Bulk cancel dispatches to RFA service in `DocumentService.bulkCancel`
- [x] T080 [P] [US4] Bulk cancel dispatches to Transmittal service in `DocumentService.bulkCancel`
- [x] T081 [P] [US4] Bulk cancel dispatches to Drawing service in `DocumentService.bulkCancel`
- [x] T082 [P] [US4] Bulk cancel dispatches to Circulation force-close in `DocumentService.bulkCancel`
- [x] T083 [US4] Add Checkbox column + `<BulkActionBar>` support via `DataTable`/`ServerDataTable` shared selection in all list pages
- [x] T084 [P] [US4] Add Checkbox + `<BulkActionBar>` to RFAs list
- [x] T085 [P] [US4] Add Checkbox + `<BulkActionBar>` to Transmittals list
- [x] T086 [P] [US4] Add Checkbox + `<BulkActionBar>` to Drawings list
- [x] T087 [P] [US4] Create `DocumentModule` in `backend/src/modules/document/document.module.ts` (cross-type bulk operations)
- [x] T088 [P] [US4] Implement Bulk Tag endpoint `POST /documents/bulk/tag` in `backend/src/modules/document/document.controller.ts` (cross-type)
- [x] T089 [P] [US4] Implement Bulk Export endpoint `POST /documents/bulk/export` in `backend/src/modules/document/document.controller.ts` (metadata only, no files)

**Checkpoint**: DC can bulk cancel/tag/export all document types with async progress

---

## Phase 7: User Story 5 — System Admin Maintenance Console (Priority: P3)

**Goal**: System Admin can access 4-tab Maintenance Console for Numbering Tools, Orphan Cleanup, Vector Sync, Emergency Unlock

**Independent Test**: Create orphan file in Storage, System Admin opens Orphan Cleanup tab, scans, purges — verify file deleted and Audit Log recorded

### Tests for User Story 5

- [x] T090 [P] [US5] Unit test for MaintenanceService in `backend/src/modules/maintenance/maintenance.service.spec.ts` (numbering gaps, orphan scan, vector sync, emergency unlock)
- [~] T091 [P] [US5] E2E test for Maintenance Console in `backend/test/maintenance-console.e2e-spec.ts` (4 tabs, scan, purge, audit) — backend E2E; needs test DB

### Implementation for User Story 5

- [x] T092 [US5] Create Maintenance module in `backend/src/modules/maintenance/maintenance.module.ts`
- [x] T093 [US5] Implement `MaintenanceController` in `backend/src/modules/maintenance/maintenance.controller.ts` (4 sub-paths with per-tab CASL permission)
- [x] T094 [P] [US5] Implement Numbering Tools service in `backend/src/modules/maintenance/services/numbering-tools.service.ts` (gap audit, counter sync, manual override, void & replace)
- [x] T095 [P] [US5] Implement Orphan Cleanup service in `backend/src/modules/maintenance/services/orphan-cleanup.service.ts` (scan storage, purge with audit)
- [x] T096 [P] [US5] Implement Vector Sync service in `backend/src/modules/maintenance/services/vector-sync.service.ts` (missing docs, batch re-embed via BullMQ, orphan scan)
- [x] T097 [P] [US5] Implement Emergency Unlock service in `backend/src/modules/maintenance/services/emergency-unlock.service.ts` (stuck locks, force release, bulk hard-purge)
- [x] T098 [US5] Create Maintenance Console page in `frontend/app/(admin)/admin/doc-control/maintenance/page.tsx` (4 tabs)
- [x] T099 [P] [US5] Implement Numbering Tools tab UI in `frontend/components/admin/maintenance/numbering-tools-tab.tsx`
- [x] T100 [P] [US5] Implement Orphan Cleanup tab UI in `frontend/components/admin/maintenance/orphan-cleanup-tab.tsx`
- [x] T101 [P] [US5] Implement Vector Sync tab UI in `frontend/components/admin/maintenance/vector-sync-tab.tsx`
- [x] T102 [P] [US5] Implement Emergency Unlock tab UI in `frontend/components/admin/maintenance/emergency-unlock-tab.tsx`
- [x] T103 [US5] Add Maintenance Console to Admin sidebar in `frontend/components/admin/sidebar.tsx`

**Checkpoint**: System Admin can use all 4 Maintenance Console tabs

---

## Phase 8: User Story 6 — ผู้ใช้ทั่วไปสร้างและแก้ไขเอกสาร DRAFT (Priority: P1)

**Goal**: Verify existing DRAFT edit flow still works after adding new actions, and 2-Tier Edit rules are enforced

**Independent Test**: Regular user creates Correspondence as DRAFT, edits all fields, submits — verify after submit, regular user cannot edit content (only DC can edit metadata)

### Tests for User Story 6

- [x] T104 [P] [US6] Regression test for DRAFT edit flow in `backend/src/modules/correspondence/correspondence.service.spec.ts` (DRAFT: all fields editable; IN_REVIEW: only metadata patch; APPROVED: only metadata patch)
- [~] T105 [P] [US6] E2E test for 2-Tier Edit enforcement in `backend/test/two-tier-edit.e2e-spec.ts` (create DRAFT → edit → submit → verify edit disabled for regular user) — needs test DB

### Implementation for User Story 6

- [x] T106 [US6] Verify existing Correspondence update endpoint enforces 2-Tier Edit in `backend/src/modules/correspondence/correspondence.service.ts` (DRAFT: full edit; non-DRAFT: reject content changes, redirect to metadata patch)
- [x] T107 [P] [US6] Verify RFA update endpoint enforces DRAFT-only edit in `backend/src/modules/rfa/rfa.service.ts`
- [x] T108 [US6] Update Correspondence detail page to show "Edit Content" (DRAFT only) vs "Edit Metadata" (DC, non-CANCELLED) in `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx`

**Checkpoint**: 2-Tier Edit rules enforced across all document types

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Error UX, i18n verification, backward compatibility, final verification

- [x] T109 [P] Implement ADR-007 layered error responses in all new endpoints (Permission 403, Validation 422, Partial 200 with failedSideEffects, System 500)
- [x] T110 [P] Add actionable error messages with i18n keys to all new dialogs and toasts in `frontend/components/documents/`
- [x] T111 [P] Implement Bulk Partial Failure summary dialog in `frontend/components/documents/bulk-result-dialog.tsx` (per-item success/failed table)
- [x] T112 [P] Verify backward compatibility — existing endpoints return response superset (new fields added, no fields removed)
- [x] T113 [P] Verify all user-facing text uses i18n keys (grep for hardcoded Thai/English strings in new components)
- [x] T114 [P] Add Circulation force-close UI to Circulation list in `frontend/app/(dashboard)/circulation/page.tsx` (Row Action: Force Close with reason dialog)
- [x] T115 [P] Add Action Bar to all 5 detail pages in `frontend/app/(dashboard)/*/[uuid]/page.tsx` (consistent action bar with status-aware availability)
- [x] T116 Run backend verification: `cd backend && pnpm tsc --noEmit && pnpm lint && pnpm test`
- [x] T117 Run frontend verification: `cd frontend && pnpm tsc --noEmit && pnpm lint && pnpm test`
- [~] T118 Run E2E verification: `cd frontend && pnpm playwright test --grep="document-actions"` (Playwright infra unavailable — backend E2E coverage used)
- [x] T119 Update assurance ledger checkpoint after all phases complete in `specs/200-fullstacks/253-unified-doc-crud/ledger.md`
- [x] T120 Finalize ledger terminal status before handoff in `specs/200-fullstacks/253-unified-doc-crud/ledger.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (P1) and US6 (P1) can proceed in parallel
  - US2 (P1) can proceed after US1 (shares Row Actions component)
  - US3 (P2) can proceed after US1 (shares Hard-Delete dialog)
  - US4 (P2) can proceed after US1 (shares Bulk Action Bar)
  - US5 (P3) can proceed independently after Foundational
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational → US1 (MVP — Cancel all types)
- **US6 (P1)**: Foundational → US6 (verify DRAFT edit + 2-Tier enforcement)
- **US2 (P1)**: Foundational → US1 (Row Actions) → US2 (Metadata Patch)
- **US3 (P2)**: Foundational → US1 (strategy pattern) → US3 (Hard-Delete)
- **US4 (P2)**: Foundational → US1 (list integration) → US4 (Bulk)
- **US5 (P3)**: Foundational → US5 (independent — Maintenance Console)

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002-T004, T006-T009)
- All Foundational entity changes marked [P] can run in parallel (T013-T016)
- All Foundational DTOs marked [P] can run in parallel (T017-T021)
- All Foundational frontend components marked [P] can run in parallel (T023-T029)
- US1 tests (T030-T036) can run in parallel
- US1 strategy implementations (T039-T044) can run in parallel
- US2 per-type metadata patch (T057-T060) can run in parallel
- US5 tab implementations (T094-T097, T099-T102) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Cancel) + US6 (DRAFT edit verification) → MVP (P1 stories)
3. Add US2 (Metadata Patch) → DC can correct errors without cancel/recreate
4. Add US3 (Hard-Delete) → Superadmin can purge erroneous documents
5. Add US4 (Bulk Operations) → DC can manage 100s of documents efficiently
6. Add US5 (Maintenance Console) → System Admin can maintain system health
7. Polish → Error UX, i18n, backward compat, final verification

---

## Notes

- 120 tasks total across 9 phases
- US1 has 19 tasks (MVP — largest phase)
- US5 has 14 tasks (Maintenance Console — independent)
- Tests are REQUIRED per Decision #22 (3-Layer Testing)
- Ledger updates required at T119 (checkpoint) and T120 (terminal status)
- Commit after each task or logical group per D264 (commit discipline)
- All tasks use ADR-019 UUID (publicId only), ADR-044 (no migrations), ADR-016 (CASL), ADR-008 (BullMQ)
