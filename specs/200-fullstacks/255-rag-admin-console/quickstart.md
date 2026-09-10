// File: specs/200-fullstacks/255-rag-admin-console/quickstart.md
// Change Log:
// - 2026-09-10: Initial quickstart for Feature 255 RAG Admin Console
// - 2026-09-10: Updated with interview decisions Q1-Q45 (route, permissions, file paths, i18n namespace)

# Quickstart: RAG Admin Console

## Prerequisites

- Node.js 20+, pnpm
- MariaDB 11.8 (schema v1.9.0 applied)
- Redis (running)
- Qdrant (running)
- Ollama + np-dms-ai + np-dms-ocr models loaded
- Feature 254 backend APIs deployed and tested

## Backend Setup

```bash
# 1. เพิ่ม permission seeds (rag.admin.write + rag.retry)
#    แก้ไข specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql
#    เพิ่ม 'rag.admin.write' (Superadmin only) + 'rag.retry' (Superadmin + Org Admin)
#
# สำหรับ production migration:
#    รัน specs/03-Data-and-Storage/deltas/2026-09-10-rag-admin-permissions.sql
#    Rollback: 2026-09-10-rag-admin-permissions-rollback.sql

# 2. รัน backend
cd backend
pnpm install
pnpm run start:dev
```

## Frontend Setup

```bash
cd frontend
pnpm install
pnpm run dev
```

## Accessing the Admin Console

1. Login as Superadmin (has `rag.manage` + `rag.admin.write` + `document.classification_override` + `rag.retry`)
2. Navigate to `/admin/ai/rag-console/`
3. 5 tabs available (single page + tab navigation):
   - Dashboard tab — Ingestion Status Dashboard (US1)
   - Classification tab — Classification Override UI (US2)
   - Lifecycle tab — Generation Lifecycle Viewer (US3)
   - Metrics tab — Observability Metrics Dashboard (US4)
   - Retry tab — Failed Ingestion Retry Management (US5)

## API Endpoints (8 endpoints in RagAdminController)

| Method | Path | Permission | AiEnabledGuard | Purpose |
|--------|------|------------|----------------|---------|
| GET | `/ai/admin/rag/attachments` | `rag.manage` | No | List attachments with RAG status |
| GET | `/ai/admin/rag/attachments/classification` | `rag.manage` | No | List attachments with classification + override info |
| GET | `/ai/admin/rag/attachments/:id/generations` | `rag.manage` | No | List generation lifecycle history |
| POST | `/ai/admin/rag/attachments/:id/reingest` | `rag.admin.write` | Yes (method) | Force re-ingest (409 if BUILDING) |
| GET | `/ai/admin/rag/metrics` | `rag.manage` | No | Get observability metrics snapshot |
| POST | `/ai/admin/rag/metrics/reset` | `rag.admin.write` | No | Reset metrics (global only) |
| GET | `/ai/admin/rag/failed-ingestions` | `rag.manage` | No | List failed ingestions (2 sections) |
| POST | `/ai/admin/rag/failed-ingestions/retry` | `rag.retry` | Yes (method) | Batch retry (max 50, partial-success) |

Existing endpoint (no change):
| PATCH | `/ai/rag/attachments/:id/classification` | `document.classification_override` | No | Override classification |

## Testing

```bash
# Backend unit tests
cd backend
pnpm test -- --testPathPattern="rag-admin"

# Backend E2E tests (NestJS TestingModule + Supertest + mocked services)
pnpm test -- --testPathPattern="rag-admin" --config test/jest-e2e.json

# Frontend tests
cd frontend
pnpm test -- --testPathPattern="rag-console"

# E2E tests (Playwright)
pnpm exec playwright test --grep="rag-console"
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/modules/ai/rag-admin.controller.ts` | New admin console controller (8 endpoints) |
| `backend/src/modules/ai/services/rag-admin.service.ts` | New admin service (list/aggregate/metrics/retry) |
| `backend/src/modules/ai/dto/rag-admin.dto.ts` | New admin DTOs (list, classification, batch retry) |
| `backend/src/modules/ai/services/rag-attachment-ingestion.service.ts` | Existing — add `retryIngestion()` method |
| `backend/src/modules/ai/services/vector-cleanup.service.ts` | Existing — add `orphanScanRagAttachments()` Cron |
| `backend/test/fixtures/rag-admin-fixtures.ts` | Shared E2E fixture factory functions |
| `frontend/app/(admin)/admin/ai/rag-console/page.tsx` | Single page with 5 tabs (Dashboard | Classification | Lifecycle | Metrics | Retry) |
| `frontend/lib/services/admin-rag.service.ts` | API client (single file, 8 endpoints) |
| `frontend/hooks/ai/use-rag-admin.ts` | TanStack Query hooks |
| `frontend/components/admin/ai/rag-console/` | Shared components (RagStatusBadge, ClassificationBadge, GenerationTimeline, MetricsCard, RetryButton, ServiceUnavailableBanner, EmptyState) |
| `frontend/public/locales/{en,th}/ai.json` | i18n keys (`rag.admin.*` namespace with sub-namespaces) |
| `specs/06-Decision-Records/ADR-053-rag-admin-console-architecture.md` | Architectural decisions (8 decisions D1-D8) |

## Permission Grants

| Permission | Superadmin | Org Admin | Document Control |
|-----------|-----------|-----------|------------------|
| `rag.manage` | Yes | No | No |
| `rag.admin.write` | Yes | No | No |
| `document.classification_override` | Yes | No | No |
| `rag.retry` | Yes | Yes | No |

## Status Enum

Dashboard `ragStatus` (computed on-the-fly — NOT a stored field):

| Status | Meaning | Color |
|--------|---------|-------|
| `NOT_STARTED` | No generation exists | Gray |
| `BUILDING` | Generation in progress | Blue |
| `ACTIVE` | Generation complete, searchable | Green |
| `RETIRED` | Superseded by newer generation | Yellow |
| `FAILED` | Ingestion failed | Red |

Note: `NOT_STARTED` is a computed status (attachment exists but no generation) — not a DB enum value. DB enum for `RagAttachmentGeneration.status` is `BUILDING/ACTIVE/RETIRED/FAILED`.
