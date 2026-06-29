// File: specs/200-fullstacks/228-migration-arch-refactor/spec.md
// Change Log:
// - 2026-05-22: Initial specification derived from grill session on 03-04/03-05/03-06 + clarifications

# Feature Specification: ADR-028 Migration Architecture Refactor

**Feature Branch**: `228-migration-arch-refactor`
**Created**: 2026-05-22
**Status**: Draft
**Category**: 200-fullstacks
**Input**: "ADR-028 จากการอัพเดท 03-04, 03-05, 03-06 for Refactor ส่วนที่เกี่ยวข้อง"

## Clarifications

### Session 2026-05-22

- Q: `POST /api/ai/jobs` endpoint มีแล้วหรือยัง? → A: ยังไม่มี — ต้องพัฒนาก่อน Migration Phase เริ่ม (Blocking)
- Q: ตาราง `tags` และ `correspondence_tags` อยู่ใน production schema แล้วหรือยัง? → A: ยังไม่มี — ต้องสร้าง SQL delta (ADR-009) ก่อน Migration
- Q: Orphaned temp files policy? → A: Auto-cleanup 24 ชั่วโมง หลัง job failed หรือไม่มี commit (Scheduled BullMQ job)
- Q: Final Commit RBAC? → A: `DOCUMENT_CONTROLLER` | `ADMIN` | `SUPERADMIN`
- Q: Migration tables retention? → A: เก็บ `import_transactions` ถาวร (audit trail), Drop ที่เหลือหลัง Gate #3

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — n8n Submits AI Job via BullMQ (Priority: P1)

Migration orchestrator (n8n บน QNAP) ส่ง PDF document ผ่าน DMS API เข้า BullMQ queue แล้ว BullMQ Worker บน Desk-5439 รัน OCR + AI classification และส่งผลกลับมาให้ n8n

**Why this priority**: เป็น blocking dependency หลักของ Migration Phase — ถ้าไม่มี endpoint นี้ migration ทำไม่ได้เลย

**Independent Test**: ส่ง PDF ทดสอบผ่าน `POST /api/ai/jobs` แล้วตรวจว่า BullMQ worker ประมวลผลและคืน JSON output ถูกต้อง

**Acceptance Scenarios**:

1. **Given** migration_bot token valid + PDF อยู่ใน temp storage, **When** n8n calls `POST /api/ai/jobs` with `type: migrate-document`, **Then** response คืน `{ jobId: "<uuid>", status: "queued" }` ภายใน 2 วินาที
2. **Given** job queued, **When** n8n polls `GET /api/ai/jobs/:jobId` ทุก 5 วินาที, **Then** status เปลี่ยนเป็น `completed` พร้อม AI output JSON ภายใน 120 วินาที
3. **Given** scanned PDF (ไม่มี text layer), **When** BullMQ Worker ประมวลผล, **Then** ใช้ PaddleOCR + PyThaiNLP และคืนข้อความภาษาไทยที่อ่านได้
4. **Given** PDF ที่มี selectable text > 100 chars/page, **When** BullMQ Worker ประมวลผล, **Then** ใช้ PyMuPDF Fast Path (< 5 วินาที)
5. **Given** job failed permanently, **When** Worker บันทึก failure, **Then** temp file ถูก queue สำหรับ auto-cleanup ใน 24 ชั่วโมง

---

### User Story 2 — Document Controller Reviews Migration Queue (Priority: P2)

Document Controller หรือ Admin ตรวจสอบ AI classification results ใน Frontend Review Queue แก้ไขข้อมูลถ้าจำเป็น แล้วกด Execute Import เพื่อ commit เอกสารเข้าระบบจริง

**Why this priority**: Human-in-the-loop validation ป้องกันข้อมูลผิดเข้าระบบ Production

**Independent Test**: Login ด้วย DOCUMENT_CONTROLLER account → เข้าหน้า Migration Review Queue → เห็นรายการ PENDING → กด Execute Import → เอกสารปรากฏใน Correspondences

**Acceptance Scenarios**:

1. **Given** records ใน `migration_review_queue` ที่ status = PENDING, **When** DOCUMENT_CONTROLLER เปิดหน้า Review Queue, **Then** เห็นรายการพร้อม AI summary, confidence score, suggested tags
2. **Given** suggested tag มี `is_new: true`, **When** reviewer เห็น tag ใหม่, **Then** ระบบให้ทางเลือก: Accept new tag / Map ไป existing tag / Reject
3. **Given** reviewer กด Execute Import, **When** role คือ `DOCUMENT_CONTROLLER` | `ADMIN` | `SUPERADMIN`, **Then** Backend สร้าง Correspondence จริง, ย้าย temp file เป็น permanent, สร้าง/เชื่อม Tags
4. **Given** reviewer ที่ role อื่น (เช่น VIEWER), **When** พยายาม Execute Import, **Then** ได้รับ 403 Forbidden

---

### User Story 3 — Schema Setup: Tags Tables (Priority: P1)

DBA หรือ DevOps สร้างตาราง `tags` และ `correspondence_tags` ใน Production database ผ่าน SQL delta ตาม ADR-009

**Why this priority**: ตารางเหล่านี้จำเป็นสำหรับทั้ง AI Tag Extraction ใน Migration และ Tag system ใน Production

**Independent Test**: รัน SQL delta → ตรวจ schema → สร้าง Tag ทดสอบผ่าน API → tag ปรากฏใน correspondence

**Acceptance Scenarios**:

1. **Given** SQL delta ถูก apply, **When** ตรวจ schema, **Then** ตาราง `tags` และ `correspondence_tags` มีครบตาม data dictionary
2. **Given** tags table พร้อม, **When** AI job คืน `suggested_tags`, **Then** Backend สร้าง tag records ใหม่ (is_new: true) หรือเชื่อม existing tags ได้

---

### User Story 4 — Post-Migration Table Cleanup (Priority: P3)

หลัง Gate #3 ผ่าน (T+30 วัน) Admin ลบตาราง migration ชั่วคราวออก แต่เก็บ `import_transactions` ไว้เป็น audit trail ถาวร

**Why this priority**: Cleanup schema หลัง migration เสร็จสมบูรณ์

**Independent Test**: รัน cleanup SQL → ตรวจว่า 5 ตารางถูกลบ แต่ `import_transactions` ยังอยู่พร้อมข้อมูลครบ

**Acceptance Scenarios**:

1. **Given** Gate #3 ผ่านแล้ว, **When** รัน cleanup script, **Then** `migration_progress`, `migration_review_queue`, `migration_errors`, `migration_fallback_state`, `migration_daily_summary` ถูกลบ
2. **Given** cleanup เสร็จ, **When** ตรวจ `import_transactions`, **Then** ข้อมูล audit trail ครบถ้วน ไม่มีข้อมูลหาย

---

### Edge Cases

- BullMQ worker ล่มระหว่าง OCR — job ต้อง retry อัตโนมัติ (max 3 ครั้ง) ก่อน mark failed
- PDF เสียหาย (Corrupted) — OCR Service คืน error → n8n route ไป Error Log ไม่ block batch
- Token หมดอายุระหว่าง Migration batch ที่กำลังรัน — n8n ได้ 401 → หยุด batch + แจ้งเตือน
- AI คืน JSON ไม่ถูก format — Backend validate + route ไป Human Review Queue
- Temp file TTL หมดก่อน n8n poll เสร็จ (> 24h) — edge case ของ very large batch; ควรพิจารณา extend TTL สำหรับ active jobs
- Execute Import ซ้ำ (double-click) — `import_transactions` idempotency ป้องกัน duplicate

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบต้องมี endpoint `POST /api/ai/jobs` รองรับ `type: migrate-document` พร้อม RBAC (migration_bot token เท่านั้น)
- **FR-001a**: `Idempotency-Key` ต้อง deterministic — format: `{batchId}:{documentNumber}` (n8n สร้างจาก static data ไม่ใช่ random UUID) เพื่อให้ retry ได้ key เดิม
- **FR-001b**: Backend ต้อง double-check `import_transactions` (document_number + batch_id + status != FAILED) ก่อน enqueue BullMQ — ถ้าซ้ำ return 409 พร้อม `existingJobId` (defense-in-depth ต่างหากจาก Idempotency-Key)
- **FR-002**: ระบบต้องมี endpoint `GET /api/ai/jobs/:jobId` สำหรับ polling status และรับ AI output
- **FR-003**: BullMQ Worker ต้องรัน OCR auto-detect: PyMuPDF (extracted_chars > 100) หรือ PaddleOCR + PyThaiNLP
- **FR-004**: AI inference ต้องใช้ `gemma4:e2b` เท่านั้น ผ่าน Ollama บน Desk-5439 (ห้าม model อื่น)
- **FR-005**: Temp files ต้องถูก auto-cleanup ใน 24 ชั่วโมง หลัง job `failed` หรือไม่มี commit (Scheduled BullMQ job)
- **FR-005a**: Cleanup scheduler ต้อง exclude temp files ที่ถูก reference โดย `migration_review_queue.status = PENDING` — ห้ามลบ file ที่รออยู่ใน review queue
- **FR-005b**: PENDING records ที่ไม่มี action ภายใน 30 วัน ต้อง auto-expire เป็น `EXPIRED` + cleanup temp file + แจ้ง Admin (BullMQ notification job)
- **FR-006**: ตาราง `tags` และ `correspondence_tags` ต้องสร้างผ่าน SQL delta ใน `specs/03-Data-and-Storage/deltas/` ตาม ADR-009
- **FR-007**: Execute Import ต้องจำกัดเฉพาะ role `DOCUMENT_CONTROLLER`, `ADMIN`, `SUPERADMIN` (CASL guard)
- **FR-007a**: Execute Import ต้อง `SELECT FOR UPDATE` บน `migration_review_queue` record ก่อน commit — ถ้า status ไม่ใช่ `PENDING` → return 409 `ALREADY_PROCESSING` (ป้องกัน race condition จาก concurrent users)
- **FR-008**: `import_transactions` ต้องเก็บถาวรเป็น audit trail; ตาราง migration อื่นๆ ต้อง Drop หลัง Gate #3
- **FR-009**: AI job output ต้องถูก log ใน `ai_audit_logs` ทุก job (ADR-023A)
- **FR-010**: Migration Token ต้องมีอายุ ≤ 7 วัน ต้อง Revoke ทันที Go-Live (ADR-023)
- **FR-010a**: Node 0 pre-flight ต้อง verify token (`GET /api/auth/me`) ก่อน process records ทุกครั้ง — ถ้า 401 → หยุด batch ทันที + log `TOKEN_EXPIRED` (ไม่ process records)
- **FR-010b**: 401 กลาง batch → write `status: FAILED, error: TOKEN_EXPIRED` ลง `migration_progress` + BullMQ notification job แจ้ง Admin — batch ต้อง resumable จาก `last_processed_index` หลัง token renew
- **FR-011**: n8n ห้ามเรียก Ollama หรือ PaddleOCR โดยตรง — ต้องผ่าน `POST /api/ai/jobs` เท่านั้น (ADR-023A)

### Key Entities

- **AI Job** (`ai_jobs` หรือ BullMQ job): ติดตามสถานะ OCR + AI inference สำหรับ document หนึ่งไฟล์
- **Tag** (`tags`): Tag ระดับ project หรือ global สำหรับจัด classify เอกสาร
- **Correspondence-Tag Link** (`correspondence_tags`): ความสัมพันธ์ M:N ระหว่าง Correspondence กับ Tags
- **Migration Review Record** (`migration_review_queue`): ผลลัพธ์จาก AI ที่รอ Human Review ก่อน commit
- **Import Transaction** (`import_transactions`): Idempotency + audit log สำหรับทุก document ที่ import

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: ทีม Migration สามารถรัน n8n batch ผ่าน `POST /api/ai/jobs` ได้โดยไม่ต้องแตะ Ollama โดยตรง
- **SC-002**: PDF ที่มี selectable text ผ่าน OCR Fast Path ใน < 5 วินาที/ไฟล์; scanned PDF ใน < 60 วินาที/ไฟล์
- **SC-003**: AI classification accuracy ≥ 90% (manual spot-check 50 docs, ตาม Gate #1 criteria)
- **SC-004**: ทุก AI job มี audit log ใน `ai_audit_logs` — 0 missing records
- **SC-005**: Execute Import สำเร็จ 100% โดยไม่มี duplicate records (`import_transactions` idempotency)
- **SC-006**: Temp files ทั้งหมดถูก cleanup ภายใน 24 ชั่วโมงหลัง job failed — 0 orphaned files หลัง 48h
- **SC-007**: ผู้ที่ไม่มีสิทธิ์ได้รับ 403 เมื่อพยายาม Execute Import — 0 unauthorized commits

---

## Assumptions

- Ollama บน Desk-5439 (RTX 2060 SUPER 8GB) พร้อมใช้งานตลอดเวลา Migration
- `gemma4:e4b Q8_0` และ `nomic-embed-text` ติดตั้งใน Ollama แล้วก่อน Gate #1
- BullMQ concurrency=1 สำหรับ ai-batch queue (ป้องกัน GPU VRAM overflow)
- n8n Free Plan บน QNAP ไม่รองรับ Environment Variables (`$env`) — ใช้ staticData แทน
- Organization Code Mapping (TBD ใน 03-06) ต้องเสร็จก่อน Gate #1

---

## ADR Reference

- **ADR-023A**: Unified AI Architecture (Model Revision) — canonical source
- **ADR-009**: Database schema changes via SQL delta (no TypeORM migrations)
- **ADR-016**: Security — Token policy, RBAC, File upload
- **ADR-008**: BullMQ queue strategy (ai-batch queue, concurrency=1)
- **ADR-028**: (this document creates the ADR) — Migration Architecture Refactor decisions
