// File: specs/06-Decision-Records/ADR-056-ai-queue-observability-retry-resilience.md
// Change Log:
// - 2026-09-16: Initial creation — กำหนดมาตรฐาน AI Queue Observability, Auto-Retry Resilience, Resource Safeguards, และ Vector Synchronization (ADR-056)

# ADR-056: AI Queue Observability, Auto-Retry Resilience, Resource Safeguards, and Vector Synchronization

**Status**: Proposed
**Date**: 2026-09-16
**Decision Makers**: Senior Full Stack Developer, Lead Systems Architect
**Related Documents**:
- [ADR-023A: Unified AI Architecture](./ADR-023A-unified-ai-architecture.md) (Preemption control, VRAM management)
- [ADR-048: AI Engine Control Center](./ADR-048-ai-engine-control-center.md) (VRAM monitoring, global empty-queue guard)
- [ADR-055: Attachment Manual Re-OCR](./ADR-055-attachment-manual-re-ocr.md) (Priority 1 queueing on manual re-OCR)
- [ADR-022: RAG Status Tracking & Attachment Lifecycle](./ADR-022-rag-status-tracking.md) (rag_status = 'PENDING' | 'PROCESSING' | 'INDEXED' | 'FAILED')
- [ADR-016: Security & Authentication Strategy](./ADR-016-security-authentication.md) (RBAC Matrix)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากระบบปัจจุบัน:
1. **ขาดหน้าจอ Monitoring และ Alert เฉพาะสำหรับ AI Queues:**
   - ปัจจุบันมี **9 Queues** ในระบบ (`np-dms-ocr`, `np-dms-ai`, `ai-batch`, `ai-realtime`, `ai-rag-ingest`, `ai-rag-query`, `ai-rag-metadata-sync`, `ai-rag-generation-cleanup`, `ai-rag-generation-retention`, `ai-vector-deletion`) หากงานล้มเหลว หรือมี `rag_status = 'FAILED'` Admin จะไม่ทราบทันที ต้องรอให้ผู้ใช้แจ้งปัญหาเข้ามา _(นับใหม่จาก `backend/src/modules/ai/ai.module.ts` — เดิมเอกสารนี้ระบุ "6+ Queues" ซึ่งไม่ตรงกับ `queue.constants.ts` ปัจจุบัน)_
2. **การรับมือ Transient Errors ใน `ai-rag-ingest` และ `np-dms-ocr` ยังไม่สมบูรณ์:**
   - เมื่อ Qdrant หรือ Ollama เกิดปัญหาชั่วคราว (เช่น Timeout / Connection drop) งานจะถูก mark เป็น `FAILED` ทันทีโดยไม่มีการทำ Exponential Backoff Retry ที่เป็นระเบียบ
3. **ขาดความสะดวกในการกู้คืนงาน Batch ที่ล้มเหลว (Bulk Retry):**
   - หลังรีสตาร์ตเซิร์ฟเวอร์ หรือแก้ไข Infra ปัญหาเสร็จแล้ว Admin ไม่มีวิธีสั่ง "Retry All Failed Ingestions" ในการคลิกเดียว ต้องไล่ทำทีละรายการ
4. **ความเสี่ยงข้อมูลไม่สอดคล้องระหว่าง MariaDB กับ Qdrant (Vector Drift):**
   - หาก Qdrant เกิดขัดข้อง หรือ Vector หายไปจาก Qdrant DB แต่ตาราง `attachments` ใน MariaDB ยังคงเป็น `rag_status = 'INDEXED'` ระบบค้นหาแบบ Semantic Search จะหาไม่พบโดยไม่มีสัญญาณแจ้งเตือน

---

## Context and Problem Statement

ในสถาปัตยกรรม AI ของ LCBP3 ข้อมูลเอกสารและไฟล์แนบจะไหลผ่าน BullMQ Queues แบบหลายขั้นตอน (Sequential & Parallel Pipelines) การที่ระบบขาด Monitoring แบบ Real-time, ไม่มี Auto-Retry Policy สำหรับ Network Transient Faults, และขาด Scheduled Maintenance สำหรับ Vector Reconciliation อาจทำให้เกิดสะดุดในกระบวนการ RAG / OCR / Extraction โดยที่ทีมผู้ดูแลระบบไม่สามารถรับรู้และแก้ไขได้ทันท่วงที

---

## Decision Drivers

- **High Reliability & Resilience:** ระบบต้องสามารถกู้คืนตัวเอง (Self-healing) จาก transient error ได้โดยไม่ต้องรบกวน Admin
- **Operational Observability:** ผู้ดูแลระบบต้องเห็นสถานะของทั้ง 9 Queues และรู้ทันทีเมื่อมีรายการประมวลผลล้มเหลว (`rag_status = 'FAILED'`)
- **Resource & VRAM Safety:** ต้องรักษาวินัยการแย่งใช้ GPU (Preemption) ระหว่างงานด่วน `ai-realtime` กับงานเบื้องหลัง `ai-batch` ตาม ADR-023A / ADR-048
- **Data Integrity & Consistency:** ข้อมูล Vector ใน Qdrant ต้องสอดคล้องกับตาราง `attachments` ใน MariaDB 100%

---

## Decisions

### D1: BullMQ Queue Observability & Monitoring

**Decision**:
1. **BullMQ Admin Dashboard / Health API:** ติดตั้ง/เปิดใช้งาน Dashboard (เช่น Bull-Board หรือ Custom Admin UI Component) เพื่อแสดงสถานะ Active, Waiting, Failed, Delayed, Paused ของทั้ง **9 Queues** ได้แก่:
   - `QUEUE_NP_DMS_OCR` (`np-dms-ocr`)
   - `QUEUE_NP_DMS_AI` (`np-dms-ai`)
   - `QUEUE_AI_BATCH` (`ai-batch`)
   - `QUEUE_AI_REALTIME` (`ai-realtime`)
   - `QUEUE_AI_RAG_INGEST` (`ai-rag-ingest`)
   - `QUEUE_AI_RAG` (`ai-rag-query`) — ⚠️ ชื่อ queue จริงคือ `ai-rag-query` ไม่ใช่ `ai-rag`
   - `QUEUE_AI_RAG_METADATA_SYNC` (`ai-rag-metadata-sync`)
   - `QUEUE_AI_RAG_GENERATION_CLEANUP` (`ai-rag-generation-cleanup`)
   - `QUEUE_AI_RAG_GENERATION_RETENTION` (`ai-rag-generation-retention`)
   - `QUEUE_AI_VECTOR_DELETION` (`ai-vector-deletion`)

   Dashboard implementation ต้อง import รายชื่อ queue จาก `backend/src/modules/ai/constants/queue.constants.ts` เป็น source of truth เดียว ห้าม hardcode queue name list ซ้ำในเอกสารหรือ UI component เพื่อไม่ให้ drift เมื่อมี queue ใหม่เพิ่มในอนาคต

   **RBAC:** ใช้ permission `system.manage_all` เดียวกับ endpoint อื่น ๆ ของ AI Control Center (ตาม precedent จาก grill session ก่อนหน้าใน ADR-048 ที่ปฏิเสธการสร้าง RBAC tier ใหม่) — ห้ามสร้าง permission หรือ role check แบบใหม่แยกต่างหากสำหรับ Dashboard นี้
2. **Alert System สำหรับ `rag_status = 'FAILED'` — In-app Banner เท่านั้น (v1):**
   - เมื่องานสกัดข้อมูลหรือสร้าง Vector เกิดล้มเหลว และอัปเดต `attachments.rag_status = 'FAILED'` ระบบจะส่ง Alert Notification ขึ้นใน BullMQ Dashboard / Admin Console พร้อมแสดง `rag_last_error` เพื่อให้ Admin ตรวจสอบได้ในที่เดียว
   - **Scope decision:** พิจารณาแล้วว่าจะใช้ in-app banner (pull-based) เท่านั้นในเวอร์ชันนี้ **ไม่ reuse** email/SMTP pipeline (`notification.processor.ts`) แม้จะมีของอยู่แล้วและช่วยแก้ปัญหา "ทราบทันที" ตาม Gap Analysis ได้ตรงกว่า — trade-off ที่ยอมรับคือ Admin ยังต้องเปิดหน้า Dashboard เองถึงจะเห็น alert ไม่ใช่ push แบบ real-time; หากต้องการ email/push ในอนาคตให้เปิดเป็น ADR แยกต่างหาก (ไม่ใช่ retrofit เข้า ADR-056 นี้)

---

### D2: Auto-Retry Policy & Bulk Re-Ingest Action

**Decision**:
1. **Exponential Backoff Retry บน `QUEUE_AI_RAG_INGEST` และ `QUEUE_NP_DMS_OCR`:**
   - Target config สำหรับทั้งสอง Queue:
     - `attempts: 3` (ลองใหม่สูงสุด 3 ครั้ง)
     - `backoff: { type: 'exponential', delay: 5000 }` (เว้นระยะห่าง 5s, 10s, 20s ตามลำดับ)
   - **สถานะปัจจุบัน (`ai.module.ts`):**
     - `QUEUE_AI_RAG_INGEST` มี config นี้อยู่แล้วครบ (`attempts: 3, backoff: exponential/5000ms`) — **ไม่ต้องแก้ไข**, เก็บไว้เป็น verification checkpoint เท่านั้น
     - `QUEUE_NP_DMS_OCR` มี retry อยู่แล้วแต่เป็น `attempts: 2` — **งานจริงของ D2.1 คือ bump เป็น `attempts: 3`** เพื่อให้สอดคล้องกับ `ai-rag-ingest` และทนต่อ transient error ที่มาจาก VRAM unload/reload รอบ OCR sidecar call ได้ดีขึ้น (ดู GPU Coordination ใน `CONTEXT.md`)
   - ป้องกันไม่ให้ job ถูก mark เป็น `FAILED` ทันทีเมื่อเกิด transient network error กับ Qdrant หรือ Ollama
2. **Bulk Re-Ingest — ขยาย Endpoint เดิม (ไม่สร้างใหม่):**
   - Endpoint `POST /ai/admin/rag/failed-ingestions/retry` (`rag-admin.controller.ts`, Feature 255/T010) มีอยู่แล้ว แต่เป็น **selection-based** (client ต้องส่ง `attachmentPublicIds[]` เอง, cap 50/ครั้ง) — **ไม่สร้าง endpoint ใหม่ `/bulk-reingest-failed` ซ้ำซ้อน**
   - ขยาย `RagAdminBatchRetryDto` เพิ่ม flag `selectAll: boolean` (optional filters เช่น `projectPublicId` ประกอบได้) — เมื่อ `selectAll: true` ให้ `RagAdminService` query ทุกแถวที่ `rag_status = 'FAILED'` แทนการรับ `attachmentPublicIds[]` จาก client
   - **Batch enqueue เป็นก้อนละ 50** (reuse cap เดิมเป็น internal chunk size) เข้า `QUEUE_AI_RAG_INGEST` เพื่อกัน queue/DB flood เมื่อจำนวน FAILED มีหลักพันแถว — สิทธิ์เข้าถึงคงเดิมตาม RBAC ของ `rag-admin.controller.ts` (ADR-016)

---

### D3: Resource Safeguards & Priority Enforcement

**Decision**:
1. **VRAM Preemption Control — Non-Regression Constraint (ADR-023A / ADR-048), ไม่มี Code Change:**
   - นี่ไม่ใช่ Decision ใหม่ แต่เป็นข้อกำหนด verification-only ว่ากลไกที่มีอยู่แล้ว 2 อัน **ต้องไม่ถูกแตะหรือ merge เข้าด้วยกัน** โดย D1 (Dashboard) หรือ D2 (Retry):
     - `ai-realtime.processor.ts:237-282` — reference-counted pause/resume ผ่าน BullMQ event `active`/`completed`/`failed`: เมื่อมี Job เข้า `ai-realtime` (counter 0→1) สั่ง Pause `ai-batch` ทันที และเมื่อ realtime jobs หมด (counter กลับ 0) จึง Resume `ai-batch` ป้องกัน GPU OOM Crash — ตรงตาม ADR-023A ทุกประการ
     - `vram-monitor.service.ts:205-333` — คนละกลไก คนละ trigger (admin สั่ง VRAM action ด้วยมือ ไม่ใช่ job เข้าคิวอัตโนมัติ): global empty-queue guard + Redis mutex `ai:model:transitioning` (15s TTL) + auto-eviction ตาม ADR-048
   - หาก D1 Dashboard ต้องการแสดงสถานะ pause ของ `ai-batch` แบบ real-time ให้ดึงจาก `ai-realtime.processor.ts` โดยตรง (อ่านอย่างเดียว ไม่แก้ pause/resume logic)
2. **Priority Queueing บน Manual Re-OCR (ADR-055 D3) — ⚠️ Implement ค้าง ไม่ใช่ Maintain:**
   - ตรวจสอบโค้ดแล้วพบว่า `AiQueueService` **ยังไม่มี** method `enqueueAttachmentReOcr()` และไม่มีการใช้ `priority: 1` กับ `QUEUE_NP_DMS_OCR` ที่ไหนเลย — ADR-055 D3 (priority queueing บน Manual Re-OCR) ยังไม่ถูก implement จริงในโค้ด แม้จะถูกอ้างถึงในฐานะ "พฤติกรรมเดิมที่ต้องคง" ก็ตาม
   - ดังนั้น scope ของ D3.2 คือ **implement ใหม่** ไม่ใช่ maintain: เพิ่ม `enqueueAttachmentReOcr()` ใน `AiQueueService` ที่ enqueue เข้า `QUEUE_NP_DMS_OCR` ด้วย `priority: 1` เสมอ เพื่อข้ามคิวงาน Batch ขนาดใหญ่ ทำให้ Admin ได้รับผลลัพธ์ที่รวดเร็วโดยไม่ต้องรอกดดันคิวอื่น
   - _Follow-up แยก: ต้องตรวจสอบสถานะ implementation ของ ADR-055 ทั้งฉบับ เพราะอาจมี gap อื่นนอกเหนือ D3 ด้วย (spawn เป็น task แยก ไม่รวมใน ADR-056 นี้)_

---

### D4: Vector Synchronization & Health Check Cron Job

**สถานะปัจจุบัน (ตรวจโค้ดก่อนตัดสินใจ):** `backend/src/modules/maintenance/services/vector-sync.service.ts` (Feature 253 "Maintenance Console") มี `findMissingVectors()` / `findOrphanVectors()` อยู่แล้ว แต่ (1) เป็น manual-trigger only ไม่มี `@Cron`, (2) `enqueueReEmbed()` เรียก `enqueueRagPrepare()` เข้า `ai-batch` โดยไม่แตะ `rag_status` เลย — คนละ path จาก manual reingest ที่ใช้ `ai-rag-ingest` — ทำให้ระบบมี "re-embed path" ซ้อนกัน 2 ทาง

**Decision**:
1. **Daily Vector Health Check Cron Job (ไม่ใช่ Weekly):**
   - เพิ่ม `@Cron` ใน `maintenance/services/vector-sync.service.ts` ที่มีอยู่แล้วโดยตรง (**ไม่สร้างไฟล์ใหม่ใน `ai/services/`**) รันทุกวัน (เช่น `EVERY_DAY_AT_3AM` คู่กับ `rag-generation-retention.processor.ts` ที่ใช้เวลาเดียวกันอยู่แล้ว) แทน weekly ตามดราฟต์เดิม — เหตุผล: full Qdrant scroll ต่อ project ไม่หนักเท่า OCR/LLM job ขณะที่ RAG search หายไปเงียบ ๆ นานสุด ~6.9 วันภายใต้ weekly cadence เป็นความเสี่ยงที่สูงกว่า cost ของการรันถี่ขึ้น
   - ตรวจสอบความสอดคล้องระหว่าง `attachments` ที่มี `rag_status = 'INDEXED'` ใน MariaDB กับ Points ที่มีจริงใน Qdrant Vector Collection
2. **Automatic Re-Embed Trigger — รวมเหลือ Path เดียวผ่าน `ai-rag-ingest`:**
   - แก้ `enqueueReEmbed()` ให้เลิกเรียก `enqueueRagPrepare()`/`ai-batch` แบบเดิม เปลี่ยนไปใช้ **path เดียวกับ manual reingest** (`ingestionService.ingest()` → `enqueueRagAttachmentIngestion()` → `QUEUE_AI_RAG_INGEST`) เพื่อให้ระบบเหลือ "re-embed เอกสารเดิม" แค่ 1 code path เดียว ไม่ว่าจะ trigger จาก auto-healing cron หรือ admin manual reingest
   - หากพบว่าไฟล์แนบมีสถานะเป็น `INDEXED` ใน MariaDB แต่ไม่พบ Vector Points ใน Qdrant ระบบจะอัปเดตสถานะเป็น `PENDING` ก่อน แล้วจึงส่ง Job เข้า `QUEUE_AI_RAG_INGEST` เพื่อทำการ Re-embed อัตโนมัติ (Self-Healing Vector Consistency)

---

## 🔍 Impact Analysis

### Affected Components

| Component | Level | Impact Description | Required Action |
|-----------|-------|-------------------|-----------------|
| **Backend AI Module** | 🔴 High | เพิ่ม Retry Policy, Bulk Re-Ingest API, และ Health Check Cron | อัปเดต Queue Option และสร้าง Health Check Service |
| **Admin UI / Dashboard** | 🟡 Medium | เพิ่ม Bull-Board หรือ Queue Monitoring Page + Alert Banner | พัฒนา UI Component แสดงสถานะ 9 Queues |
| **Database (MariaDB)** | 🟢 Low | ใช้ schema เดิม (`rag_status`, `rag_last_error`) ตาม ADR-022 | ไม่ต้องเพิ่ม Column ใหม่ |
| **Qdrant Vector DB** | 🟢 Low | รองรับการตรวจสอบ Vector Existence | ใช้งาน `qdrantService.count()` หรือ `scroll()` |

---

## 📋 Summary of Required Changes

#### 🔴 Critical Changes
- [ ] **Queue Configuration** - `backend/src/modules/ai/ai.module.ts`: bump `QUEUE_NP_DMS_OCR` จาก `attempts: 2` → `attempts: 3` (`QUEUE_AI_RAG_INGEST` มี config นี้อยู่แล้ว — no-op)
- [ ] **Re-OCR Priority Queueing (ADR-055 D3 ค้าง)** - `backend/src/modules/ai/services/ai-queue.service.ts`: เพิ่ม `enqueueAttachmentReOcr()` ที่ enqueue เข้า `QUEUE_NP_DMS_OCR` ด้วย `priority: 1` — ยังไม่มี method นี้อยู่เลยในโค้ดปัจจุบัน
- [ ] **Bulk Re-Ingest `selectAll`** - `backend/src/modules/ai/rag-admin.controller.ts` + `services/rag-admin.service.ts`: เพิ่ม `selectAll` flag ใน `RagAdminBatchRetryDto`, batch enqueue ก้อนละ 50 (ไม่สร้าง endpoint ใหม่)

#### 🟡 Important Changes
- [ ] **Vector Health Check Cron** - `backend/src/modules/maintenance/services/vector-sync.service.ts` (path ที่ถูกต้อง — ไม่ใช่ `ai/services/`): เพิ่ม `@Cron` daily (`EVERY_DAY_AT_3AM`) และแก้ `enqueueReEmbed()` ให้ใช้ path `ingestionService.ingest()` → `enqueueRagAttachmentIngestion()` → `ai-rag-ingest` แทน `enqueueRagPrepare()`/`ai-batch` เดิม พร้อม flip `rag_status` → `PENDING` ก่อน enqueue
- [ ] **Queue Monitoring Dashboard** - `frontend/src/app/admin/ai/queues/page.tsx`: เพิ่ม Dashboard ติดตามสถานะทั้ง 9 Queues (import ชื่อจาก `queue.constants.ts`) และแจ้งเตือน `rag_status = 'FAILED'` แบบ in-app banner; ใช้ permission `system.manage_all`

#### 🟢 Guidelines
- [ ] Non-Regression only — ห้ามแก้ pause/resume logic ใน `ai-realtime.processor.ts` และห้ามแก้ guard/mutex/auto-eviction ใน `vram-monitor.service.ts` ระหว่าง implement D1/D2/D4
