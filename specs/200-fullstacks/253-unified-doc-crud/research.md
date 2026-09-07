# Phase 0 Research: Unified Document CRUD Management

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## Research Tasks

### R-001: Side Effects Orchestrator Pattern (NestJS)

**Decision**: Use explicit `DocumentSideEffectsService` with Transaction Boundary Pattern (critical effects in transaction, non-critical post-commit).

**Rationale**: 
- LCBP3 does not use `@nestjs/event-emitter` — adding it would introduce implicit dependencies
- Explicit orchestrator is testable, debuggable, and visible in code
- Critical effects (Workflow Termination, Circulation Force-Close) must be in transaction per Decision #19
- Non-critical effects (Search Re-index, Notifications, Vector Deletion) have existing retry mechanisms (BullMQ, pending_vector_deletions, orphanScan)

**Alternatives considered**:
- `@nestjs/event-emitter` with `@OnEvent()` — rejected: implicit, harder to track all side effects
- Inline in each service — rejected: duplicated, inconsistent retry policies

**Codebase evidence**:
- `backend/src/modules/correspondence/correspondence.service.ts:1141` — force-close circulation in try-catch within transaction
- `backend/src/modules/correspondence/correspondence.service.ts:1181` — fire-and-forget search re-index
- `backend/src/modules/ai/services/vector-cleanup.service.ts:121` — `orphanScan()` for vector cleanup
- `backend/src/modules/notification/notification.processor.ts` — BullMQ notification processing

### R-002: Optimistic Lock Implementation (TypeORM)

**Decision**: Use TypeORM `@VersionColumn` for entities that need optimistic locking (Correspondence, RFA, Transmittal). For Drawings (which use Soft Delete), use manual version check via `updatedAt` comparison.

**Rationale**:
- `@VersionColumn` is TypeORM's built-in optimistic lock mechanism — auto-increments on save
- Manual version check via `updatedAt` is needed for entities without a version column (Drawings)
- Frontend sends `expectedVersion` in DTO; backend rejects if mismatch

**Alternatives considered**:
- `SELECT ... FOR UPDATE` (pessimistic) — rejected: performance impact, deadlock risk with background jobs
- No lock — rejected: Lost Update risk confirmed in Decision #15

**Codebase evidence**:
- ADR-002 already uses `@VersionColumn` for Document Numbering — pattern established
- `backend/src/modules/correspondence/entities/correspondence.entity.ts` — has `@VersionColumn`

### R-003: Redis Redlock for Hard-Delete and Bulk Cancel

**Decision**: Use existing Redis Redlock pattern (from ADR-002 Document Numbering) with keys `hard-delete:{publicId}` and `bulk-cancel:{bulkId}`.

**Rationale**:
- Redlock is already in the codebase for Document Numbering — reuse the pattern
- Hard-Delete needs lock to prevent conflict with `orphanScan` and `retryPendingDeletions`
- Bulk Cancel needs lock to prevent duplicate bulk operations on the same items

**Alternatives considered**:
- DB-level advisory lock — rejected: MariaDB advisory locks are session-scoped, not distributed
- No lock — rejected: race condition between Hard-Delete and background jobs

**Codebase evidence**:
- ADR-002 Document Numbering uses Redis Redlock + DB optimistic lock (double-lock)
- `backend/src/modules/numbering/` — existing Redlock implementation

### R-004: Type-Specific Strategy Pattern (Backend)

**Decision**: Create `DocumentActionStrategy` interface with per-type implementations. Each strategy defines: canCancel, canHardDelete, canMetadataPatch, cascadePolicy, sideEffectsPolicy.

**Rationale**:
- 5 document types have different behaviors (Decision #8): Correspondence/RFA/Transmittal use Cancel (status), Drawings use Soft Delete (deletedAt), Circulation uses Force Close
- Hard-Delete cascade differs per type (Decision #10): Transmittal doesn't cascade to items, Drawings cascade to files+vectors
- Strategy pattern allows adding new document types without modifying shared code

**Alternatives considered**:
- Single service with switch/case — rejected: violates Open/Closed Principle, hard to test
- Separate controllers per type with no shared interface — rejected: inconsistent API contract

### R-005: Frontend Shared Polymorphic Action System

**Decision**: Build shared components in `components/documents/` that accept a `DocumentActionStrategy` prop defining available actions, labels, and confirmation behavior per type.

**Rationale**:
- 5 document types share the same UI shell (Row Actions, Dialogs, Bulk Bar) but differ in labels and behavior
- Strategy prop allows the same component to render differently per type without duplication
- CASL `Can` checks are applied uniformly in the shell, strategy provides type-specific overrides

**Alternatives considered**:
- Separate components per type — rejected: 5× duplication, inconsistent UX
- Single component with if/else — rejected: unmaintainable as types grow

### R-006: Centralized Query Key Registry

**Decision**: Create `lib/query-keys.ts` with structured query keys for all modules, enabling cross-module invalidation.

**Rationale**:
- Current hooks define keys inline (e.g., `correspondenceKeys`, `rfaKeys`) — no cross-module reference
- Cancel Correspondence needs to invalidate `circulation` lists (side effect) — requires knowing circulation keys
- Central registry prevents typos and enables IDE autocomplete

**Alternatives considered**:
- Global `queryClient.clear()` — rejected: destroys all cache, defeats purpose
- Inline cross-module invalidation — rejected: fragile, hardcoded strings

### R-007: Maintenance Console Architecture

**Decision**: New `modules/maintenance/` NestJS module with `MaintenanceController` exposing 4 sub-endpoints. Frontend at `/admin/doc-control/maintenance` with 4 tabs.

**Rationale**:
- Maintenance operations are system-level (not document-level) — separate module is cleaner
- Each tab has different permission (numbering_override, orphan_cleanup, vector_sync, emergency_unlock)
- Reuses existing services: `DocumentNumberingService` for Numbering Tools, `VectorCleanupService` for Vector Sync, `StorageService` for Orphan Cleanup

**Alternatives considered**:
- Add to existing Admin Controller — rejected: Admin Controller is for AI/governance, not document maintenance
- Separate microservice — rejected: overkill for internal admin tool

### R-008: Permission Seed Changes (ADR-044)

**Decision**: Add new permissions directly to `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` (no migration per ADR-044). Adjust `correspondence.delete` role mapping to prevent DC from accidentally getting Hard-Delete.

**Rationale**:
- ADR-044 amends ADR-009: no TypeORM migrations, edit SQL directly
- `correspondence.delete` (ID 83) currently checks `system.manage_all` — must be changed to check `correspondence.delete` with `system.manage_all` as fallback
- DC role should have `correspondence.cancel` but NOT `correspondence.delete`

**Alternatives considered**:
- TypeORM migration — rejected: violates ADR-044
- New permission `correspondence.hard_delete` — considered but `correspondence.delete` already exists and is semantically correct

**Codebase evidence**:
- `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` — existing permission seeds
- `backend/src/modules/correspondence/correspondence.controller.ts` — hard-delete checks `system.manage_all`

### R-009: Bulk Operations Async Progress

**Decision**: Use BullMQ for bulk operations with progress tracking via job ID. Frontend polls job status or uses SSE for real-time progress.

**Rationale**:
- Bulk Cancel of 100 items may take 30-60s — too long for synchronous HTTP
- BullMQ is already in the stack (ADR-008) — reuse for bulk processing
- Job ID allows frontend to poll progress and show per-item results

**Alternatives considered**:
- Synchronous HTTP — rejected: timeout risk, poor UX for 100 items
- WebSocket — rejected: overkill for one-way progress updates, BullMQ already available

### R-010: Audit Diff Storage

**Decision**: Store Before/After Diff as JSON in audit log `metadata` column. For Hard-Delete Snapshot, store as separate JSON in `metadata` with key `hardDeleteSnapshot`.

**Rationale**:
- Audit log already has a `metadata` JSON column — no schema change needed
- JSON diff is flexible for different field sets per document type
- `bulkId` stored as `metadata.bulkId` for correlation

**Alternatives considered**:
- Separate audit_diff table — rejected: adds schema complexity, ADR-044 prefers minimal changes
- Separate columns per field — rejected: inflexible, different fields per type

**Codebase evidence**:
- `backend/src/modules/audit/` — existing audit module with `@Audit()` decorator
- Audit entity has `metadata` JSON column
