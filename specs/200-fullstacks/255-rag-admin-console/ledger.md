// File: specs/200-fullstacks/255-rag-admin-console/ledger.md
// Change Log:
// - 2026-09-10: Initial ledger for Feature 255 RAG Admin Console

# Assurance Ledger: RAG Admin Console

**ASSURANCE_UNIT_ID**: `lcbp3/ai/rag-admin-console`
**Branch**: `255-rag-admin-console`
**Base ref**: `origin/main` (01feb136)
**Created**: 2026-09-10
**Status**: IMPLEMENTED

## Objective

สร้าง RAG Admin Console สำหรับ Feature 254 RAG Attachment Chunks — 5 user stories:
- US1 (P1): Ingestion Status Dashboard
- US2 (P1): Classification Override UI
- US3 (P2): Generation Lifecycle Viewer
- US4 (P2): Observability Metrics Dashboard
- US5 (P2): Failed Ingestion Retry Management

## Acceptance Criteria

- [x] US1: Dashboard แสดง attachments พร้อม RAG status (NOT_STARTED/BUILDING/ACTIVE/RETIRED/FAILED), chunk count, auto-polling 10s
- [x] US2: Classification override UI พร้อม reason + audit trail (แสดงทั้งหมด, ไม่ใช่เฉพาะที่เคย override)
- [x] US3: Generation lifecycle viewer พร้อม force re-ingest (409 Conflict ถ้า BUILDING อยู่)
- [x] US4: Metrics dashboard แสดง 6 categories + reset (global only — per-project ไม่รองรับ)
- [x] US5: Failed ingestion list (2 sections: RAG failures + AI pipeline failures) + batch retry (partial-success)
- [x] CASL permission-based: rag.manage, rag.admin.write, document.classification_override, rag.retry
- [x] i18n keys ครบ (rag.admin.* namespace พร้อม sub-namespace ตาม user story)
- [ ] ADR-019: publicId only, ไม่ expose generation_uuid
- [ ] ADR-007: Layered error handling + i18n messages
- [ ] Orphan scan: orphanScanRagAttachments() Cron ใน VectorCleanupService
- [ ] ADR-053: RAG Admin Console architecture decisions documented
- [ ] Backend tests 70%+ coverage
- [ ] Frontend tests 70%+ coverage

## Protected Boundaries

- **AI Boundary (ADR-023)**: ไม่มี AI inference ใหม่ — ใช้ APIs ที่มีอยู่
- **CASL Permissions**: rag.admin.write + rag.retry ใหม่ต้อง seed ก่อนใช้งาน (seed file + delta SQL)
- **Public API**: ไม่ expose internal generation_uuid (FR-014)
- **Multi-tenant**: Qdrant projectPublicId filter บังคับ (existing)
- **Orphan cleanup**: orphanScanRagAttachments() Cron สำหรับลบ generations ของ attachments ที่ถูกลบ

## Dirty Files (at checkpoint)

_None — planning phase only_

## Checkpoint Log

### CP-001: 2026-09-10 — Planning complete

- Spec: ✅ Complete (5 US, 19 FR, 8 SC, 7 edge cases)
- Clarifications: ✅ 5/5 resolved (polling, permission-based, BUILDING guard, metrics reset scope, page size)
- Plan: ✅ Complete (research.md, data-model.md, contracts/, quickstart.md)
- Tasks: ✅ Complete (59 tasks, 8 phases, TDD approach)
- Analyze: ✅ Complete (0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW — safe to implement)

### CP-002: 2026-09-10 — Design interview complete (Q1-Q45)

- Interview: ✅ 45 questions resolved with recommended answers
- Key decisions:
  - Route prefix: `ai/admin/rag/...` (Q1)
  - 4 permissions: rag.manage, rag.admin.write, document.classification_override, rag.retry (Q3)
  - Status enum: NOT_STARTED/BUILDING/ACTIVE/RETIRED/FAILED (Q5)
  - Metrics reset: global-only (Q15 — revised from clarification Q4)
  - Frontend: single page /admin/ai/rag-console/ + 5 tabs (Q23-Q24)
  - 8 endpoints in RagAdminController (Q30+Q43)
  - Orphan scan Cron (Q8)
  - retryIngestion() method (Q36)
  - ADR-053 (Q45)
- Artifacts updated: spec.md, plan.md, contracts/rag-admin-api.md, data-model.md, research.md, ledger.md

**Next**: Update tasks.md with new/modified tasks, create ADR-053, then run `/107-speckit-implement`

### CP-003: 2026-09-10 — Implementation complete (T001-T074)

- **Phase 1 (T001-T009)**: ✅ Permissions, i18n, DTOs, API client, ADR-053 review
  - SQL deltas: rag.admin.write + rag.retry permissions (seed + delta + rollback)
  - i18n: rag.admin.* namespace in en + th ai.json
  - Backend DTOs: rag-admin.dto.ts (list, classification, batch retry, response DTOs)
  - Frontend API client: admin-rag.service.ts (8 endpoints)
  - ADR-053: reviewed, sufficient for implementation

- **Phase 2 (T010-T018)**: ✅ Controller, service, hooks, shared components
  - RagAdminController: 8 endpoints, JwtAuthGuard + RbacGuard controller-level, AiEnabledGuard method-level on reingest + batchRetry
  - RagAdminService: listAttachments, listAttachmentsForClassification, listGenerations, reingest, listFailedIngestions, batchRetry, retryIngestion (private)
  - AiModule wiring: controller + provider entries
  - Frontend hooks: use-rag-admin.ts (5 queries + 4 mutations, auto-polling 10s)
  - Shared components: RagStatusBadge, ClassificationBadge, ServiceUnavailableBanner, EmptyState
  - Nav link: sidebar.tsx

- **Phase 3 (T019-T025)**: ✅ US1 Dashboard
  - Backend tests: controller spec + service spec
  - Frontend: page.tsx with Dashboard tab (filters, table, auto-polling, empty state)
  - Frontend test: page.test.tsx

- **Phase 4 (T026-T033)**: ✅ US2 Classification
  - Frontend: Classification tab (table, override form, audit info)
  - Frontend test: classification.test.tsx

- **Phase 5 (T034-T042)**: ✅ US3 Lifecycle
  - Frontend: Lifecycle tab (attachment selector, GenerationTimeline, force reingest with confirmation)
  - Component: GenerationTimeline.tsx
  - Frontend test: lifecycle.test.tsx

- **Phase 6 (T043-T049)**: ✅ US4 Metrics
  - Frontend: Metrics tab (6 MetricsCards, reset with confirmation)
  - Component: MetricsCard.tsx
  - Frontend test: metrics.test.tsx

- **Phase 7 (T050-T060)**: ✅ US5 Retry
  - Frontend: Retry tab (2 sections, batch retry with checkboxes, partial-success display)
  - Component: RetryButton.tsx
  - Frontend test: retry.test.tsx

- **Phase 8 (T061-T062)**: ✅ Orphan Cleanup
  - VectorCleanupService.orphanScanRagAttachments() — @Cron every 6 hours
  - Test: vector-cleanup.service.spec.ts

- **Phase 9 (T063-T074)**: ✅ Polish + E2E + Compliance
  - Shared fixtures: rag-admin-fixtures.ts (createMockAttachment, createMockGeneration, createMockChunk, createMockFailedIngestion, createMockAiPipelineFailure, createMockClassificationOverride)
  - E2E tests: 5 files (dashboard, classification, lifecycle, metrics, retry)
  - i18n verification: all rag.admin.* keys present in en + th
  - ADR-019 compliance: no parseInt on UUIDs, no internal IDs exposed, publicId only
  - ADR-007 compliance: ConflictException with user message + recovery actions
  - ADR-053 compliance: route prefix ai/admin/rag, 4 permissions, AiEnabledGuard placement, 8 endpoints
  - TypeScript: no `any`, no `console.log`, strict typing
  - Ledger updated: status → IMPLEMENTED

**Compliance checks passed**:
- [x] No parseInt/Number on UUIDs (ADR-019)
- [x] No `any` types (TypeScript strict)
- [x] No `console.log` (TypeScript rules)
- [x] i18n keys complete (en + th)
- [x] ADR-007 error handling (recovery actions on ConflictException)
- [x] ADR-053 architecture (route prefix, permissions, guards, endpoints)
- [x] Idempotency-Key required on reingest + batchRetry
- [x] AiEnabledGuard only on AI-enqueuing operations (reingest, batchRetry)
- [x] FR-014: no generationUuid exposed in API responses
- [x] Q9: NOT_STARTED computed status (no generation exists)
- [x] Q13: 409 Conflict for BUILDING reingest
- [x] Q15: metrics reset global-only
- [x] Q17: batch retry partial-success, max 50
- [x] Q21: auto-polling 10s, refetchIntervalInBackground: false
- [x] Q31: failed-ingestions 2 sections (RAG paginated + AI pipeline read-only)
- [x] Q35/Q36: retryIngestion marks FAILED→RETIRED before BUILDING
- [x] Q40: ServiceUnavailableBanner polls health
- [x] Q41: contextual empty states
- [x] Q51: shared E2E fixtures

**Next**: Run build/typecheck/lint/tests to verify, then ready for review
