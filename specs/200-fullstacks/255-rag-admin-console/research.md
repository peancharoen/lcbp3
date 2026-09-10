// File: specs/200-fullstacks/255-rag-admin-console/research.md
// Change Log:
// - 2026-09-10: Initial research for Feature 255 RAG Admin Console
// - 2026-09-10: Updated with interview decisions Q1-Q45 (route prefix, permissions, metrics reset, i18n, force re-ingest)

# Phase 0 Research: RAG Admin Console

## R1: Existing Backend APIs (Feature 254)

**Decision**: ใช้ backend APIs ที่มีอยู่ของ Feature 254 เป็นฐาน — เพิ่มเฉพาะ endpoints ที่ขาด

**Rationale**: Feature 254 ได้ implement backend APIs ครบถ้วนแล้ว (RagAttachmentController, RagGenerationService, RagClassificationService, RagObservabilityService) — งานหลักของ Feature 255 คือ frontend UI + admin-specific endpoints ที่ขาด

**Alternatives considered**:
- สร้าง backend module ใหม่ทั้งหมด → reject: ซ้ำซ้อน, ละเมิด DRY
- ใช้ API เดิมทั้งหมด → reject: ไม่มี list/paginate, batch retry, metrics reset endpoints

### Existing Endpoints (RagAttachmentController)

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST | `/ai/rag/attachments/:attachmentPublicId/ingest` | `rag.manage` | เริ่ม ingestion (Idempotency-Key required) |
| GET | `/ai/rag/attachments/:attachmentPublicId/status` | `rag.manage` | ดูสถานะ ingestion |
| POST | `/ai/rag/attachments/query` | `rag.manage` | ค้นหา RAG (project-scoped) |
| PATCH | `/ai/rag/attachments/:attachmentPublicId/classification` | `document.classification_override` | Override classification |

### Missing Endpoints (ต้องสร้างใหม่ — route prefix `ai/admin/rag/...`)

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/ai/admin/rag/attachments` | `rag.manage` | List + paginate + filter attachments by RAG status |
| GET | `/ai/admin/rag/attachments/classification` | `rag.manage` | List attachments with classification + override info |
| GET | `/ai/admin/rag/attachments/:attachmentPublicId/generations` | `rag.manage` | List generation lifecycle history |
| POST | `/ai/admin/rag/attachments/:attachmentPublicId/reingest` | `rag.admin.write` | Force re-ingest (AiEnabledGuard + Idempotency-Key) |
| GET | `/ai/admin/rag/metrics` | `rag.manage` | Get observability metrics snapshot |
| POST | `/ai/admin/rag/metrics/reset` | `rag.admin.write` | Reset metrics (global only) |
| GET | `/ai/admin/rag/failed-ingestions` | `rag.manage` | List failed ingestions (2 sections) |
| POST | `/ai/admin/rag/failed-ingestions/retry` | `rag.retry` | Batch retry failed ingestions (AiEnabledGuard + Idempotency-Key) |

## R2: Frontend Admin AI Page Pattern

**Decision**: ใช้ pattern เดิมของ admin AI pages — Next.js App Router, 'use client', TanStack Query, shadcn/ui, useTranslations

**Rationale**: โค้ดเบสมี admin AI section ที่ `frontend/app/(admin)/admin/ai/` อยู่แล้ว (rag-playground, system, prompts, sandbox) — ใช้ pattern เดียวกันเพื่อความสม่ำเสมอ

**Pattern observed** (from `rag-playground/page.tsx`):
- `'use client'` directive
- `useQuery` from `@tanstack/react-query` สำหรับ data fetching
- shadcn/ui components: Card, Button, Badge, Select, Textarea, Progress
- `useTranslations` hook สำหรับ i18n
- `projectService` สำหรับ project dropdown
- `adminAiService` สำหรับ API calls
- `toast` from sonner สำหรับ notifications
- Layout: `AiConsoleHeader` + `AiInfrastructureMonitoring` + children

## R3: Permission Seeds

**Decision**: เพิ่ม permission `rag.admin.write` และ `rag.retry` ใน seed SQL + delta SQL — ไม่มีอยู่ในปัจจุบัน

**Rationale**: `rag.manage` (มีอยู่, Superadmin only) ใช้สำหรับ view, `document.classification_override` (มีอยู่) สำหรับ classification — แต่ต้องแยก read/write:
- `rag.admin.write` — force re-ingest + metrics reset (Superadmin only — operations ที่มีผลกระทบสูง)
- `rag.retry` — batch retry (Superadmin + Org Admin — operator ที่ดูแล failed ingestions)

**Existing permissions**:
- `rag.manage` — Superadmin only (seed line 1168)
- `document.classification_override` — Superadmin only (seed line 1469)
- `rag.query` — granted to multiple roles

**New permissions**:
- `rag.admin.write` — Superadmin only (force re-ingest + metrics reset)
- `rag.retry` — Superadmin + Org Admin (batch retry failed ingestions)

**Seed approach**: แก้ `lcbp3-v1.9.0-seed-permissions.sql` (สำหรับ fresh installs) + สร้าง delta SQL `2026-09-10-rag-admin-permissions.sql` (สำหรับ production migration) + rollback delta

## R4: Observability Metrics Service

**Decision**: ใช้ `RagObservabilityService.getSnapshot()` และ `reset()` ที่มีอยู่ — global-only reset (ไม่เพิ่ม per-project reset)

**Rationale**: Service มี `getSnapshot()` และ `reset()` อยู่แล้ว — `reset()` เป็น global reset เท่านั้น การเพิ่ม per-project reset ต้อง refactor ใหญ่ (เพิ่ม `Map<projectPublicId, Metrics>` + partition ทุก counter) ซึ่งเกิน scope ของ Feature 255 และ metrics ส่วนใหญ่ (swap, qdrantDeletion, cleanup) เป็น system-level ไม่ใช่ per-project

**Metrics available** (from `getSnapshot()`):
- `swap`: generation swap metrics (started, completed, rolledBack, activeConcurrent, maxConcurrent)
- `qdrantDeletion`: Qdrant deletion metrics (attempted, succeeded, partialFailures, totalPendingRetries)
- `cleanup`: cleanup metrics (processed, succeeded, failed)
- `ingestionDuration`: histogram (count, sumMs, buckets: 100ms/500ms/2s)
- `chunkCount`: counter (totalChunks, ingestions)
- `vectorLatency`: histogram (count, sumMs, buckets: 50ms/100ms/500ms/2s)
- `staleResultRate`: counter (filtered, total)
- `fallbackRate`: counter (fullTextFallbacks, totalQueries)
- `cleanupRetryRate`: counter (retries)
- `uptimeMs`: uptime

**Limitation**: Metrics เป็น in-memory (ไม่ persisted, ไม่แบ่งตาม project) — per-project reset ไม่รองรับ (document limitation ใน spec)

## R5: i18n Structure

**Decision**: เพิ่ม `rag.admin.*` namespace ใน `ai.json` locale files ที่มีอยู่ (sub-namespace ตาม user story)

**Rationale**: ai.json มีอยู่แล้วที่ `frontend/public/locales/en/ai.json` และ `th/ai.json` — เพิ่ม namespace ใหม่แทนการสร้างไฟล์ใหม่

**Key structure**:
```json
{
  "rag": {
    "admin": {
      "dashboard": { "title": "...", "refresh": "...", "empty_state": "..." },
      "classification": { "override_button": "...", "reason_label": "..." },
      "lifecycle": { "title": "...", "generation_status": { ... } },
      "metrics": { "reset_button": "...", "confirm_reset": "..." },
      "retry": { "button": "...", "batch_button": "...", "partial_success": "..." },
      "status": {
        "NOT_STARTED": "...", "BUILDING": "...", "ACTIVE": "...", "RETIRED": "...", "FAILED": "..."
      }
    }
  }
}
```

## R6: Force Re-ingest Guard

**Decision**: ป้องกัน force re-ingest ถ้ามี BUILDING generation อยู่แล้ว (clarification Q3) — ตรวจใน controller ไม่ใช่ service

**Rationale**: ป้องกัน resource waste และ race condition บน GPU (BullMQ concurrency=1, ADR-023A)

**Implementation**: ใน `RagAdminController.reingest()` — เรียก `generationService.getStatus(attachmentPublicId)` ก่อน ถ้า `status === 'BUILDING'` → throw 409 Conflict (ไม่ใช่ BusinessException 400) พร้อม user-friendly message + recovery guidance

**Note**: ไม่แก้ `ingest()` เดิม เพื่อไม่กระทบ operational endpoint ที่ใช้อยู่ — แยก check ที่ admin controller
