// File: specs/200-fullstacks/253-unified-doc-crud/plan.md
// Change Log:
// - 2026-09-06: Initial implementation plan for Unified Document CRUD Management

# Implementation Plan: Unified Document CRUD Management with Admin Maintenance Tools

**Branch**: `253-unified-doc-crud` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/253-unified-doc-crud/spec.md`

## Summary

This feature unifies document CRUD management across 5 document types (Correspondence, RFA, Transmittal, Drawings, Circulation) into the Dashboard with CASL RBAC, while adding an Admin Maintenance Console for emergency/data-integrity operations. The approach uses a 2-Layer Architecture (Common Shell + Type-Specific Strategy) for frontend components, a Side Effects Orchestrator Service for backend cross-module effects, and granular permissions with hierarchy fallback. Implementation follows Inside-Out phasing: Backend APIs → Shared Frontend Components → Dashboard Integration → Admin Maintenance Console.

## Technical Context

**Language/Version**: TypeScript 5.x (Backend: NestJS 11, Frontend: Next.js 16)
**Primary Dependencies**: TypeORM, TanStack Query v5, CASL, BullMQ, Redis (Redlock), Elasticsearch, Qdrant, shadcn/ui, RHF + Zod
**Storage**: MariaDB 11.8 (primary), Redis (cache + locks + queues), MinIO/Local (files), Elasticsearch (search index), Qdrant (vectors)
**Testing**: Jest (backend unit/integration), Vitest + React Testing Library (frontend unit), Playwright (E2E)
**Target Platform**: Linux server (QNAP Container Station), Web browser (Chrome/Firefox/Edge)
**Project Type**: Web application (monorepo: backend/ + frontend/)
**Performance Goals**: Cancel action < 30s end-to-end, Hard-Delete < 10s, Bulk Cancel 100 items < 60s
**Constraints**: ADR-019 UUID (publicId only), ADR-044 (no migrations, edit SQL directly), ADR-016 (CASL 4-Level RBAC), ADR-002 (Redis Redlock), ADR-008 (BullMQ notifications), ADR-007 (layered errors), ADR-021 (workflow lifecycle)
**Scale/Scope**: 5 document types × ~4 actions each = ~20 new endpoints, 5 shared frontend components, 4 maintenance console tabs, ~15 new permissions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Status | Notes |
|------|--------|-------|
| ADR-019 UUID | ✅ Pass | All endpoints use publicId (UUIDv7), no parseInt |
| ADR-044 Schema | ✅ Pass | New permissions added to seed-permissions.sql directly (no migration) |
| ADR-016 Security | ✅ Pass | CASL guards on all new endpoints, ThrottlerGuard on maintenance, Idempotency-Key on POST/PATCH |
| ADR-002 Numbering | ✅ Pass | Maintenance Console uses existing DocumentNumberingAdminController (Redlock + optimistic lock) |
| ADR-008 Notifications | ✅ Pass | All notifications via BullMQ (NotificationService.send), never inline |
| ADR-007 Errors | ✅ Pass | Layered error classification (Permission/Validation/Partial/System) with actionable messages |
| ADR-021 Workflow | ✅ Pass | Cancel terminates workflow instances within transaction (critical side effect) |
| TypeScript Strict | ✅ Pass | Zero `any`, zero `console.log`, Thai comments, English identifiers |
| i18n | ✅ Pass | All user-facing text via document.action.* and document.type.* keys |
| Backward Compatibility | ✅ Pass | Additive-only, response superset, permission guard before changing correspondence.delete |

**Post-Phase 1 Re-check**: ✅ All gates pass after design. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/253-unified-doc-crud/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contract documentation)
│   ├── cancel-hard-delete.md
│   ├── metadata-patch.md
│   ├── bulk-operations.md
│   └── maintenance-tools.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (105-speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/
├── common/
│   └── services/
│       └── document-hard-delete.service.ts       # Shared cascade delete (per-type policy)
│       └── document-side-effects.service.ts      # Side Effects Orchestrator
│       └── document-action-strategy.interface.ts # Type-Specific Strategy interface
├── modules/
│   ├── correspondence/
│   │   ├── dto/cancel-correspondence.dto.ts      # (exists)
│   │   ├── dto/bulk-cancel.dto.ts                # (exists)
│   │   ├── dto/metadata-patch.dto.ts             # NEW
│   │   └── strategies/correspondence-action.strategy.ts
│   ├── rfa/
│   │   ├── dto/metadata-patch.dto.ts             # NEW
│   │   └── strategies/rfa-action.strategy.ts
│   ├── transmittal/
│   │   ├── dto/cancel-transmittal.dto.ts         # NEW
│   │   ├── dto/metadata-patch.dto.ts             # NEW
│   │   └── strategies/transmittal-action.strategy.ts
│   ├── drawing/
│   │   ├── dto/metadata-patch.dto.ts             # NEW
│   │   └── strategies/drawing-action.strategy.ts
│   ├── circulation/
│   │   └── strategies/circulation-action.strategy.ts
│   ├── document/                                  # NEW cross-type module
│   │   ├── document.module.ts
│   │   ├── document.controller.ts                 # Bulk Tag / Bulk Export
│   │   └── services/
│   │       └── bulk-operation.service.ts
│   └── maintenance/                               # NEW module
│       ├── maintenance.controller.ts
│       ├── maintenance.service.ts
│       ├── dto/numbering-override.dto.ts
│       ├── dto/orphan-cleanup.dto.ts
│       └── dto/vector-sync.dto.ts

frontend/
├── components/
│   └── documents/                                 # NEW: Shared Polymorphic Action System
│       ├── document-row-actions.tsx               # Row Action Dropdown (⋯)
│       ├── document-cancel-dialog.tsx             # Cancel/Force-Close dialog
│       ├── document-hard-delete-dialog.tsx        # Hard-Delete dialog (Superadmin)
│       ├── document-metadata-edit-dialog.tsx      # Metadata Patch dialog
│       ├── bulk-action-bar.tsx                     # Floating bulk action bar
│       └── document-action-strategy.ts            # Frontend strategy registry
├── hooks/
│   └── use-document-actions.ts                    # Shared mutations (cancel, hardDelete, metadataPatch)
│   └── use-bulk-actions.ts                        # Bulk operations hook
├── lib/
│   └── query-keys.ts                              # Centralized Query Key Registry
│   └── services/
│       └── document-action.service.ts             # Generic API caller per type
├── app/(admin)/admin/doc-control/
│   └── maintenance/page.tsx                       # 4-tab Maintenance Console
└── public/locales/
    ├── th/common.json                             # Add document.action.* keys
    └── en/common.json                             # Add document.action.* keys
```

**Structure Decision**: Web application (Option 2). Backend uses NestJS modular architecture with new `common/services/` for shared services, `modules/document/` for cross-type bulk operations (Tag/Export), and `modules/maintenance/` for the new Maintenance Console module. Frontend uses Next.js App Router with new `components/documents/` for shared action components and `app/(admin)/admin/doc-control/maintenance/` for the Maintenance Console page.

## Complexity Tracking

> No Constitution Check violations — table left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

## Implementation Phases

### Phase 1: Backend APIs & Audit Logs (Foundation)

**Goal**: Complete all missing backend endpoints with audit, permissions, and side effects.

1. Add new permissions to `seed-permissions.sql` (edit_metadata, bulk_*, maintenance_*)
2. Create `DocumentActionStrategy` interface + per-type strategy implementations
3. Create `DocumentHardDeleteService` (shared cascade per type)
4. Create `DocumentSideEffectsService` (orchestrator with tiered criticality)
5. Add Cancel/Hard-Delete/Metadata-Patch endpoints to Transmittal, Drawings, RFA
6. Add Bulk Cancel/Tag/Export endpoints to all 5 modules
7. Create `MaintenanceController` + `MaintenanceService` (4 tabs)
8. Add `@Audit()` decorators to all new endpoints
9. Add Optimistic Lock (`@VersionColumn` or manual version check) to entities
10. Add Redis Redlock for Hard-Delete and Bulk Cancel
11. Write Unit Tests (controller + service) for all new endpoints
12. Write Integration Tests for side effects pipeline (cross-module)

### Phase 2: Frontend Shared Action System

**Goal**: Build reusable action components in `components/documents/`.

1. Create `DocumentActionStrategy` frontend interface + per-type registry
2. Build `<DocumentRowActions>` (Dropdown menu with CASL permission filtering)
3. Build `<DocumentCancelDialog>` (reason input + warning + type-specific label)
4. Build `<DocumentHardDeleteDialog>` (two-tier confirmation, "DELETE" text input)
5. Build `<DocumentMetadataEditDialog>` (3-tier field rendering)
6. Build `<BulkActionBar>` (floating bar with count + bulk action buttons)
7. Create `useDocumentActions` hook (shared mutations with cache invalidation)
8. Create `useBulkActions` hook (bulk operations with progress + result dialog)
9. Create `lib/query-keys.ts` (centralized Query Key Registry)
10. Add i18n keys to `common.json` (th + en)
11. Write Unit Tests for all shared components

### Phase 3: Dashboard Integration (5 Modules)

**Goal**: Wire shared action components into all 5 Dashboard pages.

1. Integrate `<DocumentRowActions>` into Correspondences list
2. Integrate `<DocumentRowActions>` into RFAs list
3. Integrate `<DocumentRowActions>` into Drawings list
4. Integrate `<DocumentRowActions>` into Circulation list
5. Integrate `<DocumentRowActions>` into Transmittals list
6. Add Action Bar to all 5 detail pages
7. Add Checkbox + `<BulkActionBar>` to all 5 list pages
8. Cross-module cache invalidation (Cancel Correspondence → invalidate Circulation)
9. Optimistic UI for Cancel and Metadata Patch
10. E2E tests for critical user flows (Playwright)

### Phase 4: Admin Maintenance Console

**Goal**: Build 4-tab Maintenance Console at `/admin/doc-control/maintenance`.

1. Create Maintenance Console page with 4 tabs
2. Tab 1: Numbering Tools (Sequence Gap Audit, Counter Sync, Manual Override, Void & Replace)
3. Tab 2: Orphan Cleanup (scan, size report, purge with audit)
4. Tab 3: Vector Sync (missing docs, batch re-embed)
5. Tab 4: Emergency Unlock (stuck locks, force release, bulk hard-purge)
6. Add to Admin sidebar menu
7. CASL permission guards per tab
8. E2E tests for Maintenance Console

## Ledger Decision

**Ledger Required**: Yes — this work spans multiple sessions, touches protected boundaries (data integrity, public API, auth), and involves Tier 3 complexity (cross-module side effects, workflow termination, AI vector management).

**Ledger Path**: `specs/200-fullstacks/253-unified-doc-crud/ledger.md`
**Assurance Unit ID**: `lcbp3/fullstack/unified-doc-crud`
