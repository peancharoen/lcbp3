// File: specs/200-fullstacks/228-migration-arch-refactor/plan.md
// Change Log:
// - 2026-05-22: Initial implementation plan for ADR-028 Migration Architecture Refactor

# Implementation Plan: ADR-028 Migration Architecture Refactor

**Branch**: `228-migration-arch-refactor` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)

## Summary

Refactor migration architecture ให้สอดคล้องกับ ADR-023A: n8n เรียกผ่าน BullMQ แทน Ollama โดยตรง, ใช้ `gemma4:e4b Q8_0`, OCR ผ่าน PyMuPDF/PaddleOCR, สร้าง Backend endpoint `/api/ai/jobs`, SQL delta สำหรับ `tags`/`correspondence_tags`, และ Migration Review UI

## Technical Context

**Language/Version**: TypeScript 5.x, NestJS 10.x, Next.js 14.x  
**Primary Dependencies**: BullMQ, TypeORM, CASL, TanStack Query, Zod  
**Storage**: MariaDB (SQL delta via ADR-009), Qdrant (embedding), Redis (BullMQ)  
**Testing**: Jest (Backend), Vitest (Frontend)  
**Target Platform**: QNAP NAS (Backend + n8n), Admin Desktop Desk-5439 (Ollama + OCR Worker)  
**Performance Goals**: Fast Path OCR < 5s/file; Slow Path OCR < 60s/file; AI inference < 30s  
**Constraints**: VRAM peak ~4.3GB; BullMQ concurrency=1 (ai-batch); Token TTL ≤ 7 วัน  
**Scale/Scope**: 20,000 PDF documents; ~3 วินาที/record → ~16.6 ชั่วโมงรวม

## Constitution Check

| ADR | Rule | Status |
|-----|------|--------|
| ADR-019 | UUID ทุก entity ใช้ `publicId` (UUIDv7), ห้าม `parseInt` | ✅ |
| ADR-009 | Schema changes via SQL delta เท่านั้น | ✅ (tags + correspondence_tags) |
| ADR-016 | Auth guard ทุก endpoint, token TTL ≤ 7 วัน | ✅ |
| ADR-008 | BullMQ สำหรับ background jobs | ✅ (ai-batch queue) |
| ADR-023A | n8n → DMS API → BullMQ → Ollama (ห้าม direct) | ✅ |
| ADR-007 | Layered error handling + user-friendly messages | ✅ |
| ADR-023A | gemma4:e4b Q8_0 + nomic-embed-text เท่านั้น | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/228-migration-arch-refactor/
├── spec.md
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ai-jobs-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/src/modules/
├── ai/
│   ├── ai.module.ts              (existing — เพิ่ม migrate-document job type)
│   ├── ai.controller.ts          (existing — เพิ่ม POST /api/ai/jobs, GET /api/ai/jobs/:jobId)
│   ├── ai.service.ts             (existing — เพิ่ม submitMigrationJob())
│   ├── workers/
│   │   └── migrate-document.worker.ts   (NEW — BullMQ processor)
│   └── dto/
│       ├── submit-ai-job.dto.ts         (NEW)
│       └── ai-job-result.dto.ts         (NEW)
├── tags/                                (NEW module)
│   ├── tags.module.ts
│   ├── tags.controller.ts
│   ├── tags.service.ts
│   └── entities/
│       ├── tag.entity.ts
│       └── correspondence-tag.entity.ts
└── migration/
    └── migration-review.service.ts      (existing — เพิ่ม commit logic)

specs/03-Data-and-Storage/deltas/
└── 2026-05-22-create-tags-tables.sql    (NEW — ADR-009)

frontend/app/(dashboard)/
└── migration/
    └── review/
        └── page.tsx                     (NEW — Migration Review Queue UI)

frontend/components/migration/
└── review-queue-table.tsx               (NEW)
```

## Implementation Phases

### Phase A: Backend Foundation (Prerequisite — Blocking)

**A1. SQL Delta — Tags Tables**
- สร้าง `specs/03-Data-and-Storage/deltas/2026-05-22-create-tags-tables.sql`
- ตาราง: `tags`, `correspondence_tags`
- Apply ใน staging ก่อน; production apply ที่ Gate #1

**A2. Tags Module (NestJS)**
- Entity: `Tag`, `CorrespondenceTag` (TypeORM)
- Service: CRUD + tag normalization
- Controller: GET /api/tags (project-scoped)

**A3. BullMQ Worker — migrate-document**
- Job processor ใน `ai-batch` queue
- Step 1: Fetch temp file จาก Storage
- Step 2: OCR auto-detect (PyMuPDF API / PaddleOCR API)
- Step 3: gemma4:e4b inference (metadata extraction + classification + tagging)
- Step 4: Validate JSON output
- Step 5: Store result in job

**A4. AI Jobs API Endpoints**
- `POST /api/ai/jobs` — submit job, Idempotency-Key check
- `GET /api/ai/jobs/:jobId` — polling + result retrieval
- `POST /api/ai/migration/review` — commit approved record (RBAC: DC | Admin | Superadmin)

**A5. Temp File Cleanup Scheduler**
- BullMQ Scheduled job: ทุก 1 ชั่วโมง
- ลบ temp attachments ที่ `created_at < NOW() - 24h` + ไม่มี `committed_at`

### Phase B: Frontend (After Phase A complete)

**B1. Migration Review Queue Page**
- `/migration/review` — แสดง records จาก `migration_review_queue`
- Filter: Status, Batch ID, Confidence range
- Actions: Edit metadata, Map/Accept/Reject tags, Execute Import

**B2. Tag Review Component**
- แสดง AI suggested tags พร้อม confidence score
- `is_new: true` → highlight ให้ reviewer approve/map/reject

### Phase C: ADR-028 Documentation

**C1. สร้าง ADR-028**
- `specs/06-Decision-Records/ADR-028-migration-architecture-refactor.md`
- Document ทุก decision จาก session นี้

### Phase D: Post-Migration Cleanup Script

**D1. Cleanup SQL Script**
- `specs/03-Data-and-Storage/deltas/XXXX-drop-migration-tables.sql`
- Drop 5 ตาราง migration (ยกเว้น `import_transactions`)
- Run หลัง Gate #3 ผ่าน

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| OCR Worker บน Desk-5439 ไม่พร้อม | Health check ใน Node 0 pre-flight; alert ถ้า `/api/ai/health` ไม่ตอบ |
| BullMQ job timeout (scanned PDF ใหญ่) | Timeout 120s สำหรับ poll; Worker timeout 180s; retry 3 ครั้ง |
| Tags duplicate | `UNIQUE KEY (project_id, tag_name)` + normalize lowercase+trim ก่อน insert |
| import_transactions accidentally dropped | Migration script ต้องมี `IF NOT EXISTS` + explicit exclusion comment |
