// File: specs/06-Decision-Records/ADR-053-rag-admin-console-architecture.md
// Change Log:
// - 2026-09-10: Initial creation — Feature 255 RAG Admin Console architectural decisions

# ADR-053: RAG Admin Console Architecture

**Status**: Accepted
**Date**: 2026-09-10
**Feature**: Feature 255 — RAG Admin Console

## Context

Feature 255 (RAG Admin Console) สร้าง admin UI บน backend APIs ของ Feature 254 (RAG Attachment Chunks) การออกแบบมี decisions ที่ hard-to-reverse และอาจ surprise ในอนาคต จึงบันทึกไว้ใน ADR นี้

Decisions ถูกตัดสินใจผ่าน design interview 45 คำถาม (Q1-Q45) ระหว่าง planner และ stakeholder

## Decisions

### D1: Route Prefix — `ai/admin/rag/...`

**Decision**: ใช้ route prefix `ai/admin/rag/...` สำหรับ RagAdminController

**Rationale**: Codebase มี 2 admin route patterns:
- `ai/admin/...` (AiController — 20+ endpoints, dominant pattern)
- `admin/ai/...` (intent-classifier — 3 controllers, minority)

เลือก `ai/admin/rag/...` เพื่อ match dominant pattern และรวม AI admin endpoints ทั้งหมดในตระกูลเดียว

**Alternatives rejected**:
- `ai/rag/admin/...` — สร้าง pattern ที่สาม ไม่ match อะไรเลย
- `admin/ai/rag/...` — match minority pattern

### D2: 4 Permissions (Read/Write Separation)

**Decision**: 4 permissions แยก read/write:
- `rag.manage` — view dashboard/list/lifecycle/metrics (read-only, Superadmin only)
- `rag.admin.write` — force re-ingest + metrics reset (write, Superadmin only)
- `document.classification_override` — classification override (existing, Superadmin only)
- `rag.retry` — batch retry (Superadmin + Org Admin)

**Rationale**: แยก read จาก write ตามหลัก least-privilege — operator ที่ดู dashboard ได้ไม่ควร force re-ingest หรือ reset metrics ได้โดยไม่ตั้งใจ `rag.retry` grant ให้ Org Admin เพราะเป็นงานปกติของ operator

**Alternatives rejected**:
- 3 permissions (rag.manage รวม read+write) — กว้างเกินไป
- 5 permissions (แยก force/reset) — granularity สูงเกินไป

### D3: Status Enum — Generation Status จริง (ไม่แปลง)

**Decision**: ใช้ generation status enum จริง `NOT_STARTED | BUILDING | ACTIVE | RETIRED | FAILED` ใน dashboard ไม่แปลงเป็นชื่ออื่น

**Rationale**: ลดความสับสน — admin เห็นชื่อ status เดียวกันในทุกหน้า และ map 1:1 กับข้อมูลใน DB ไม่ต้องมี translation layer i18n label แยกสำหรับ human-readable text

**Alternatives rejected**:
- `PENDING | PROCESSING | INDEXED | FAILED` (แปลงชื่อ) — สับสนกับ lifecycle viewer ที่ใช้ชื่อจริง

### D4: Metrics Reset — Global Only

**Decision**: Metrics reset เป็น global-only ไม่รองรับ per-project reset (แก้ clarification Q4 จาก "both" เป็น "global only")

**Rationale**: Metrics เป็น in-memory system-level aggregates ไม่มี per-project partition การเพิ่ม per-project reset ต้อง refactor ใหญ่ (Map<projectPublicId, Metrics> + partition ทุก counter) ซึ่งเกิน scope และ metrics ส่วนใหญ่ (swap, qdrantDeletion, cleanup) เป็น system-level ไม่ใช่ per-project

**Alternatives rejected**:
- เพิ่ม per-project counters — refactor ใหญ่, memory โต
- Redis-backed + partition — scope ใหญ่เกิน Feature 255

### D5: FAILED → RETIRED Before Retry

**Decision**: เมื่อ retry attachment ที่ FAILED ให้ mark FAILED generation เดิมเป็น RETIRED ก่อนสร้าง BUILDING ใหม่

**Rationale**: ใช้ RETIRED status ที่มีอยู่ + `cleanupRetiredGenerations()` Cron ที่มีอยู่ (ลบ RETIRED เก่ากว่า 24 ชม.) ไม่ต้องสร้าง cleanup logic ใหม่

**Alternatives rejected**:
- ปล่อย FAILED ค้าง — lifecycle viewer รก, FAILED ค้างตลอด
- ลบ FAILED เดิมก่อน retry — ต้องลบ chunks/pages + Qdrant vectors

### D6: Orphan Scan for RAG Attachments

**Decision**: เพิ่ม `orphanScanRagAttachments()` Cron ใน `VectorCleanupService` สำหรับลบ generations/chunks ของ attachments ที่ถูกลบ

**Rationale**: ไม่มี FK cascade ระหว่าง `attachments` กับ `rag_attachment_generations` ถ้า attachment ถูก hard delete แต่ generation/chunks ยังค้าง → chunks ใน Qdrant อาจถูก query ได้ (security risk) ใช้ pattern cleanup ที่มี (Cron + scan) ไม่ต้องเปลี่ยน schema

**Alternatives rejected**:
- FK cascade `ON DELETE CASCADE` — ต้องเปลี่ยน schema + อาจกระทบ performance
- แสดง orphaned ใน dashboard ให้ admin ลบ manual — ต้องเพิ่ม UI + manual operation

### D7: Frontend — Single Page + 5 Tabs

**Decision**: ใช้ single page `/admin/ai/rag-console/` + 5 tabs (Dashboard | Classification | Lifecycle | Metrics | Retry) ไม่แยก sub-routes

**Rationale**: 1:1 กับ user story ทำให้ traceability ชัดเจน และ consistent กับ `rag-playground` ที่เป็น single page

**Alternatives rejected**:
- แยก sub-routes ตาม user story — เพิ่ม complexity และ navigation
- 2 tabs (Overview + Management) — แต่ละ tab มีข้อมูลเยอะ

### D8: AiEnabledGuard — Method-Level on Operations

**Decision**: Controller-level `JwtAuthGuard + RbacGuard` เท่านั้น — method-level `AiEnabledGuard` เฉพาะ operations ที่ enqueue BullMQ (reingest, retry) ไม่ใส่บน read-only หรือ metrics reset

**Rationale**: admin console ต้องเข้าถึงได้เสมอเพื่อ diagnostic และ re-enable AI แต่ operations ที่จะส่งงานเข้า BullMQ ต้องตรวจ AI เปิดอยู่ก่อน

## Consequences

- เพิ่ม 2 permissions ใหม่ (`rag.admin.write`, `rag.retry`) ต้อง seed + delta SQL
- เพิ่ม `orphanScanRagAttachments()` Cron — eventual consistency cleanup
- `retryIngestion()` method ใหม่ใน `RagAttachmentIngestionService` — mark FAILED→RETIRED + ingest
- ไม่รองรับ per-project metrics reset (document limitation)
- ADR-049 ใช้สำหรับ Feature 255 reference เท่านั้น — ไม่ supersede ADR อื่น

## Related Documents

- [Feature 255 Spec](../../specs/200-fullstacks/255-rag-admin-console/spec.md)
- [Feature 255 Plan](../../specs/200-fullstacks/255-rag-admin-console/plan.md)
- [Feature 255 API Contracts](../../specs/200-fullstacks/255-rag-admin-console/contracts/rag-admin-api.md)
- ADR-016 — Security & Authentication (CASL/RBAC)
- ADR-023/023A — AI Integration Architecture
- ADR-007 — Error Handling Strategy
- ADR-019 — UUID Strategy
