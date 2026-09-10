// File: specs/200-fullstacks/255-rag-admin-console/plan.md
// Change Log:
// - 2026-09-10: Initial implementation plan for Feature 255 RAG Admin Console

# Implementation Plan: RAG Admin Console

**Branch**: `255-rag-admin-console` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/255-rag-admin-console/spec.md`

## Summary

Feature 255 RAG Admin Console เป็น frontend-heavy feature ที่สร้าง admin UI บน backend APIs ที่มีอยู่แล้วของ Feature 254 (RAG Attachment Chunks) ประกอบด้วย 5 user stories: (1) Ingestion Status Dashboard, (2) Classification Override UI, (3) Generation Lifecycle Viewer, (4) Observability Metrics Dashboard, และ (5) Failed Ingestion Retry Management

Backend APIs ส่วนใหญ่มีอยู่แล้ว (RagAttachmentController, RagGenerationService, RagClassificationService, RagObservabilityService) — งานหลักคือเพิ่ม 8 admin-facing endpoints ใน `RagAdminController` ใหม่ (list/paginate, classification list, generations, reingest, metrics, metrics reset, failed-ingestions, batch retry) และสร้าง frontend page พร้อม 5 tabs

## Technical Context

**Language/Version**: TypeScript 5.x (backend NestJS 11 + frontend Next.js 16)
**Primary Dependencies**: NestJS, Next.js, TanStack Query, RHF + Zod, shadcn/ui, BullMQ, MariaDB, Redis
**Storage**: MariaDB (rag_attachment_generations, rag_attachment_chunks, rag_attachment_pages), Qdrant (vectors), Redis (locks/cache)
**Testing**: Jest (backend), Vitest (frontend), Playwright (E2E)
**Target Platform**: Linux server (on-premise), browser (admin UI)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Dashboard load <3s with 500+ attachments (paginated), auto-polling 10s
**Constraints**: On-premise only, no cloud AI, CASL permission-based, i18n required (Thai/English)
**Scale/Scope**: ~1 admin page (5 tabs), ~8 new backend endpoints, ~2 new permission seeds, ~2 i18n locale files, ~1 ADR

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|-----------|--------|-------|
| ADR-019 UUID | ✅ Pass | ใช้ publicId เท่านั้น, ไม่ expose generation_uuid ใน UI (FR-014) |
| ADR-016 Security | ✅ Pass | CASL permission-based (rag.manage, rag.admin.write, document.classification_override, rag.retry), Idempotency-Key บน mutations |
| ADR-023/023A AI Boundary | ✅ Pass | ไม่มี AI inference ใหม่ — ใช้ backend APIs ที่มีอยู่ ผ่าน BullMQ |
| ADR-007 Error Handling | ✅ Pass | Layered error classification, i18n user/recovery messages |
| ADR-044 Schema | ✅ Pass | ไม่มี schema change ใหม่ — ใช้ tables ที่มีอยู่ (Feature 254) |
| ADR-008 BullMQ | ✅ Pass | Retry ผ่าน BullMQ queue (ai-batch), ไม่ inline |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/255-rag-admin-console/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/ai/
│   │   ├── rag-attachment.controller.ts          # Existing — no change (operational endpoints)
│   │   ├── rag-admin.controller.ts              # NEW — admin console controller (8 endpoints)
│   │   ├── dto/
│   │   │   └── rag-admin.dto.ts                  # NEW — admin DTOs (list, filter, batch retry, classification list)
│   │   ├── services/
│   │   │   ├── rag-admin.service.ts              # NEW — admin list/aggregate/metrics/retry service
│   │   │   ├── rag-attachment-ingestion.service.ts # Existing — add retryIngestion() method
│   │   │   ├── rag-observability.service.ts      # Existing — no change (global reset already exists)
│   │   │   ├── rag-classification.service.ts     # Existing — no change
│   │   │   └── vector-cleanup.service.ts         # Existing — add orphanScanRagAttachments() Cron
│   │   └── ai.module.ts                          # Existing — wire new controller + service
│   └── ...
└── ...

frontend/
├── app/(admin)/admin/ai/
│   ├── rag-console/                              # NEW — RAG Admin Console (single page + tabs)
│   │   └── page.tsx                              # 5 tabs: Dashboard | Classification | Lifecycle | Metrics | Retry
│   └── layout.tsx                                # Existing — add nav link
├── components/admin/ai/rag-console/               # NEW — shared components
│   ├── RagStatusBadge.tsx
│   ├── ClassificationBadge.tsx
│   ├── GenerationTimeline.tsx
│   ├── MetricsCard.tsx
│   ├── RetryButton.tsx
│   ├── ServiceUnavailableBanner.tsx
│   └── EmptyState.tsx
├── hooks/ai/
│   ├── use-rag-admin.ts                           # NEW — TanStack Query hooks
│   └── ...
├── lib/services/
│   ├── admin-rag.service.ts                       # NEW — API client (single file, 8 endpoints)
│   └── ...
└── public/locales/
    ├── en/ai.json                                 # Existing — add rag.admin.* namespace
    └── th/ai.json                                 # Existing — add rag.admin.* namespace
```

**Structure Decision**: Web application structure (Option 2) — backend NestJS module extension + frontend Next.js App Router pages under existing admin AI section.

## Complexity Tracking

_No constitution violations — no complexity justifications needed._

## Ledger Decision

**Ledger required: YES**

Rationale:
- Feature spans multiple user stories (5 US) across multiple sessions
- Touches protected boundaries (AI boundary, CASL permissions, public API)
- Multiple agents/skills will touch the same scope (backend + frontend)
- Expected to span multiple chat sessions

**Ledger path**: `specs/200-fullstacks/255-rag-admin-console/ledger.md`
**ASSURANCE_UNIT_ID**: `lcbp3/ai/rag-admin-console`
**Template**: Generic cross-session (`templates/ledger-template.md`)

## Phase 0: Research

See [research.md](./research.md) for full details.

Key findings:
- Backend APIs ส่วนใหญ่มีอยู่แล้ว — ต้องเพิ่ม 8 admin endpoints ใน RagAdminController ใหม่
- Frontend ใช้ pattern เดิม: TanStack Query + shadcn/ui + useTranslations hook
- Permission `rag.manage` มีอยู่แล้ว (Superadmin only), `document.classification_override` มีอยู่แล้ว, ต้องเพิ่ม `rag.admin.write` (Superadmin) + `rag.retry` (Superadmin + Org Admin)
- i18n keys จะเพิ่มใน `rag.admin.*` namespace ของ ai.json ที่มีอยู่ (sub-namespace ตาม user story)
- Observability metrics เป็น in-memory (ไม่ persisted) — reset ได้เฉพาะ global เท่านั้น (ไม่รองรับ per-project reset เพราะ metrics เป็น system-level aggregate)
- Route prefix: `ai/admin/rag/...` ตาม dominant pattern `ai/admin/...` ของ AiController

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md) for entity details and [contracts/](./contracts/) for API contracts.

Key design decisions:
1. **New controller**: `RagAdminController` แยกจาก `RagAttachmentController` เพื่อ separation of concerns (admin vs operational) — route prefix `ai/admin/rag/...` ตาม dominant pattern
2. **Permission-based (4 permissions)**: `rag.manage` (view), `rag.admin.write` (force re-ingest + metrics reset), `document.classification_override` (classification), `rag.retry` (batch retry)
3. **AiEnabledGuard**: Controller-level `JwtAuthGuard + RbacGuard` เท่านั้น — method-level `AiEnabledGuard` เฉพาะ operations ที่ enqueue BullMQ (reingest, retry) ไม่ใส่บน read-only หรือ metrics reset
4. **Pagination**: Offset-based, default 20 items, enum validation `[10, 20, 50]` (reject ค่าอื่น)
5. **Auto-polling**: TanStack Query `refetchInterval: 10000` (10s) + `refetchIntervalInBackground: false` (หยุดเมื่อ tab backgrounded)
6. **Status enum**: ใช้ generation status จริง `NOT_STARTED | BUILDING | ACTIVE | RETIRED | FAILED` ไม่แปลง — i18n label แยก
7. **Dashboard list**: Left join `attachments` + `rag_attachment_generations` (latest per attachment ด้วย `ROW_NUMBER()`) — compute on-the-fly ไม่ stored field
8. **Force re-ingest guard**: ตรวจ BUILDING ใน controller ก่อน delegate ไป `ingest()` — reject ด้วย 409 Conflict
9. **Metrics reset**: Global-only (`reset()` ที่มีอยู่) — ไม่รองรับ per-project (document limitation)
10. **Retry**: `retryIngestion()` method ใหม่ใน `RagAttachmentIngestionService` — mark FAILED→RETIRED ก่อนสร้าง BUILDING ใหม่
11. **Batch retry**: Partial-success + report แต่ละรายการ (max 50/batch, 1 BullMQ job/attachment)
12. **Orphan scan**: เพิ่ม `orphanScanRagAttachments()` Cron ใน `VectorCleanupService` — ลบ generations/chunks ของ attachments ที่ถูกลบ
13. **Frontend**: Single page `/admin/ai/rag-console/` + 5 tabs (Dashboard | Classification | Lifecycle | Metrics | Retry)
14. **Failed-ingestion list**: 1 endpoint คืน 2 sections (RAG failures paginate + AI pipeline failures read-only)
15. **Classification tab**: Endpoint แยก `GET /ai/admin/rag/attachments/classification` (join audit log สำหรับ override info)
16. **ADR-053**: สร้าง ADR สำหรับ architectural decisions ที่ hard-to-reverse
