# Feature Specification: AI Model Revision (ADR-023A)

**Feature Branch**: `main` (no branch — per user instruction)
**Feature Dir**: `specs/300-others/302-ai-model-revision/`
**Created**: 2026-05-15
**Status**: Ready for Planning
**ADR Source**: `specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md`

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — AI-Assisted Document Classification on Upload (Priority: P1)

เมื่อ User อัปโหลดเอกสาร (PDF) ผ่าน RFA หรือ Correspondence form ระบบต้องตรวจสอบอัตโนมัติว่าไฟล์เป็น Scanned หรือ Digital PDF จากนั้นสกัด Metadata (Document Type, Discipline, Project Code, Revision) โดยใช้ AI และนำเสนอผล Suggestion บนฟอร์ม เพื่อให้ผู้ใช้ยืนยันหรือแก้ไขก่อนบันทึก

**Why this priority**: เป็น Core User-facing Feature ที่สร้างคุณค่าหลักของระบบ AI — ผู้ใช้ทุกคนที่อัปโหลดเอกสารได้รับประโยชน์ทันที

**Independent Test**: อัปโหลด PDF → ระบบแสดง AI Suggestion ใน 30 วินาที → User กด Confirm → เอกสารบันทึกพร้อม Metadata

**Acceptance Scenarios**:

1. **Given** User อัปโหลด Digital PDF (มี text layer), **When** ระบบ commit ไฟล์, **Then** ระบบ route ไป Fast Path (ไม่ใช้ OCR) และแสดง AI Suggestion ภายใน 15 วินาที
2. **Given** User อัปโหลด Scanned PDF (image-only), **When** ระบบ commit ไฟล์, **Then** ระบบ route ไป PaddleOCR และแสดง AI Suggestion ภายใน 60 วินาที
3. **Given** AI Suggestion มี confidence ≥ 0.85, **When** แสดงบนฟอร์ม, **Then** Suggestion ถูก pre-fill และไฮไลต์สีเขียว พร้อมปุ่ม Confirm
4. **Given** AI Suggestion มี confidence ระหว่าง 0.60–0.84, **When** แสดงบนฟอร์ม, **Then** Suggestion แสดงพร้อม badge ⚠️ "ตรวจสอบก่อนยืนยัน"
5. **Given** AI Suggestion มี confidence < 0.60, **When** แสดงบนฟอร์ม, **Then** ฟิลด์ว่างเปล่า — ให้ User กรอกเอง
6. **Given** AI Service ไม่พร้อมใช้งาน (Desk-5439 ออฟไลน์), **When** User อัปโหลด, **Then** ระบบ fallback — บันทึกเอกสารได้ปกติ แสดง warning "AI ไม่พร้อม กรอก Metadata เอง"

---

### User Story 2 — RAG-based Document Q&A (Priority: P2)

User สามารถถามคำถามภาษาธรรมชาติ (ไทย/อังกฤษ) เกี่ยวกับเอกสารในโครงการ และได้รับคำตอบจาก AI พร้อม citation ว่าข้อมูลมาจากหน้าไหนของเอกสารใด โดยข้อมูลถูกจำกัดเฉพาะโครงการที่ User มีสิทธิ์เข้าถึง

**Why this priority**: เพิ่มประสิทธิภาพการค้นหาข้อมูลในเอกสาร เฉพาะกลุ่ม Power User ที่จำเป็น — รองจาก P1

**Independent Test**: ถามคำถาม → ได้คำตอบพร้อม citation ภายใน 10 วินาที → คำตอบมาจากเอกสารในโครงการเดียวกันเท่านั้น

**Acceptance Scenarios**:

1. **Given** User อยู่ในโครงการ A, **When** ส่งคำถาม RAG, **Then** คำตอบมาจากเอกสารในโครงการ A เท่านั้น (ไม่มีข้อมูลข้ามโครงการ)
2. **Given** เอกสารเพิ่งถูก commit (< 5 นาที), **When** User ถาม RAG, **Then** ระบบแจ้ง "เอกสารใหม่อาจยังไม่อยู่ใน index — ค้นหาผ่านระบบปกติก่อน"
3. **Given** RAG Q&A ใช้เวลา > 10 วินาที (p95), **When** ผ่าน SLA, **Then** Job ถูก flag ใน ai_audit_logs และ Admin รับแจ้งเตือน
4. **Given** ไม่พบเนื้อหาที่เกี่ยวข้องใน Qdrant, **When** ค้นหา, **Then** ตอบ "ไม่พบข้อมูลในเอกสารที่อยู่ใน index — ลองค้นหาด้วยคำอื่น"

---

### User Story 3 — Legacy Document Migration with AI Processing (Priority: P3)

Admin สามารถ trigger การนำเข้าเอกสาร Legacy (~20,000 ฉบับ) ผ่าน n8n โดย AI ประมวลผล OCR + Metadata อัตโนมัติ ผล Suggestion จะปรากฏใน Queue ที่ Admin Review ผ่าน DMS Frontend เพื่อ Approve หรือ Reject ก่อน Import

**Why this priority**: เป็น One-time Pre-launch activity — สำคัญแต่ไม่กระทบ Production User โดยตรง

**Independent Test**: trigger batch 10 ฉบับใน n8n → ดู migration_review_queue → Approve 5 ฉบับ → ตรวจสอบว่า 5 ฉบับ import สำเร็จและ embed ใน Qdrant

**Acceptance Scenarios**:

1. **Given** Admin วางไฟล์ใน Folder และ trigger n8n, **When** Batch ประมวลผลเสร็จ, **Then** migration_review_queue มี record สถานะ PENDING สำหรับทุกไฟล์
2. **Given** Admin Approve record ใน DMS Frontend, **When** กด Approve, **Then** เอกสาร Import เข้า DMS และ embed-document job ถูก queue อัตโนมัติ
3. **Given** มีการส่ง batch เดิมซ้ำ (Idempotency), **When** n8n trigger อีกครั้งพร้อม Idempotency-Key เดิม, **Then** ไม่มี record ซ้ำใน migration_review_queue
4. **Given** AI Confidence < 0.60 สำหรับ record, **When** แสดงใน Queue, **Then** record ถูก mark REJECTED อัตโนมัติ — Admin ต้อง Approve ด้วยตนเองหากต้องการ import

---

### User Story 4 — AI Performance Monitoring and Threshold Management (Priority: P4)

Admin สามารถดู AI Performance metrics จาก ai_audit_logs (confidence distribution, override rate) และปรับ Confidence Threshold ผ่าน environment configuration เพื่อ recalibrate ระบบหลังจากได้ข้อมูลจริงจาก Migration Phase แรก

**Why this priority**: Operational concern — จำเป็นหลัง Go-live แต่ไม่บล็อก Launch

**Independent Test**: ดู Dashboard แสดง confidence score distribution → เปรียบเทียบกับ Admin override rate → ปรับ ENV → restart service → ตรวจสอบ threshold ใหม่มีผล

**Acceptance Scenarios**:

1. **Given** Admin เข้า /admin/ai-staging, **When** ดู dashboard, **Then** เห็น avg confidence, override rate, rejected rate แยกตาม document_type
2. **Given** REJECTED rate > 30%, **When** Admin ต้องการปรับ threshold, **Then** ระบบแสดงคำแนะนำ threshold ใหม่พร้อม rationale
3. **Given** Admin ลบ ai_audit_logs record (test data), **When** ลบ, **Then** การลบถูกบันทึกใน audit_logs ด้วย action: 'AI_AUDIT_LOG_DELETED'

---

### Edge Cases

- ถ้า PDF > 50MB (upload limit) → reject ก่อนถึง AI pipeline
- ถ้า PDF มีหน้าเดียวแต่มี text น้อยกว่า 100 chars → ใช้ Slow Path (OCR) แทน Fast Path
- ถ้า embed-document job fail 3 ครั้ง → dead-letter queue; Admin ได้รับแจ้ง; เอกสารยังค้นหาได้ผ่าน DB search
- ถ้า Qdrant unavailable → BullMQ retry; RAG Q&A ตอบ "ระบบค้นหา AI ชั่วคราวไม่พร้อม"
- ถ้า GPU temp > 85°C (Desk-5439) → ai-batch queue pause อัตโนมัติ; ai-realtime ยังทำงาน
- เอกสารถูก delete จาก DMS → ต้อง delete chunks ออกจาก Qdrant ด้วย (document_public_id filter)

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST ตรวจจับประเภท PDF (Digital vs Scanned) อัตโนมัติโดยใช้ `extracted_chars > OCR_CHAR_THRESHOLD` โดยไม่ให้ User เลือก
- **FR-002**: ระบบ MUST ส่ง PDF เข้า gemma4:e4b สูงสุด 3 หน้าแรกเท่านั้น สำหรับงาน Classification และ Tagging
- **FR-003**: ระบบ MUST ฝัง Vector จากเอกสารทั้งฉบับ (full-document chunking) สำหรับ RAG — ไม่จำกัด 3 หน้า
- **FR-004**: AI Inference ทั้งหมด MUST ผ่าน BullMQ Worker บน NestJS — ห้าม n8n เรียก Ollama โดยตรง
- **FR-005**: `QdrantService.search()` MUST รับ `projectPublicId: string` เป็น required parameter เสมอ
- **FR-006**: `embed-document` MUST ถูก queue อัตโนมัติหลัง document commit (parallel กับ AI Suggestion) — ห้าม manual trigger
- **FR-007**: BullMQ MUST มี 2 queues แยกกัน: `ai-realtime` (RAG Q&A, AI Suggest) และ `ai-batch` (OCR, Extract, Embed) ทั้งคู่ concurrency=1
- **FR-008**: ระบบ MUST pause `ai-batch` อัตโนมัติเมื่อ `ai-realtime` มี active job; MUST resume `ai-batch` เมื่อ `ai-realtime` job completed **หรือ** failed (ไม่ว่า outcome ใด) — ห้าม `ai-batch` ค้างสถานะ paused ตลอดไป (ผ่าน BullMQ Event hooks: `active`, `completed`, `failed`)
- **FR-009**: Legacy Migration MUST ใช้ Idempotency-Key `<doc_number>:<batch_id>` ป้องกันบันทึกซ้ำ
- **FR-010**: ระบบ MUST บันทึกทุก AI interaction ใน `ai_audit_logs` รวมถึง confidence_score, model_name, ai_suggestion_json, human_override_json
- **FR-011**: การ Delete ai_audit_logs MUST บันทึกใน `audit_logs` (`action: 'AI_AUDIT_LOG_DELETED'`) และเฉพาะ SYSTEM_ADMIN เท่านั้น
- **FR-012**: Typhoon Cloud API (`rag/typhoon.service.ts`) MUST ถูก remove ออกจาก codebase ทั้งหมด
- **FR-013**: ระบบ MUST fallback gracefully เมื่อ AI Service ไม่พร้อม — เอกสารยังอัปโหลดได้ปกติ
- **FR-014**: AI Suggestion MUST ผ่านการ validate กับ Master Data (`/api/meta/categories`) ก่อนนำเสนอ — ห้าม AI สร้างประเภทใหม่
- **FR-017**: `document.service.ts` (และทุก service ที่เรียก AI queue) MUST wrap `queueSuggestJob()` + `queueEmbedJob()` ใน try/catch — on catch: `Logger.error('AI job queue failed', { documentPublicId, error })`; document commit MUST NOT fail หรือ return 5xx ต่อ user; ioredis offline queue จัดการ short Redis blip อัตโนมัติ (Scenario 3, QuizMe 2026-05-15)
- **FR-018**: `documents` table MUST มี column `ai_processing_status ENUM('PENDING','PROCESSING','DONE','FAILED') DEFAULT 'PENDING'` — set `PENDING` เมื่อ document commit; set `PROCESSING` เมื่อ job ถูก dequeue; set `DONE` เมื่อ ai-suggest + embed-document สำเร็จทั้งคู่; set `FAILED` เมื่อ job เข้า dead-letter; ใช้ detect documents ที่ยังไม่ได้ประมวลผล (ADR-009: SQL delta #15, Scenario 3, QuizMe 2026-05-15)
- **FR-016**: `AiModule` MUST implement `OnModuleInit` — บน startup ตรวจสอบ: ถ้า `ai-batch` paused AND `ai-realtime` มี active job count = 0 → `ai-batch.resume()` อัตโนมัติ; บันทึก `Logger.warn('ai-batch auto-resumed on startup')` เพื่อ traceability (ป้องกัน stale paused state หลัง crash — Scenario 2, QuizMe 2026-05-15)
- **FR-015**: เมื่อ AI Suggestion สำหรับ categorical field (document_type, discipline) ไม่ตรงกับ Master Data — ระบบ MUST แสดง suggestion text พร้อม badge "⚠️ ไม่รู้จัก — กรุณาเลือกจาก dropdown"; confidence badge ยังแสดงค่าตามปกติ; `ai_audit_logs.ai_suggestion_json` บันทึก raw AI output; `human_override_json` บันทึก value ที่ user เลือก (Scenario 1 — QuizMe 2026-05-15)

### Key Entities

- **AiJob**: Job ใน BullMQ (`ai-realtime` / `ai-batch`), มี jobType, documentPublicId, projectPublicId, status, result
- **AiAuditLog**: บันทึก AI interaction รวม confidence_score, model_name, human_override_json (ดู Table `ai_audit_logs`)
- **MigrationReviewQueue**: staging สำหรับ Legacy Migration (ดู Table `migration_review_queue`) — status: PENDING → IMPORTED | REJECTED
- **QdrantChunk**: Vector chunk ใน Qdrant, มี payload: `{document_public_id, project_public_id, page_number, chunk_index}`
- **DocumentEmbedding**: metadata ของ embedded document ใน DMS DB (linked กับ Qdrant collection)

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: AI Suggestion ปรากฏบนฟอร์มภายใน 30 วินาที สำหรับ Digital PDF และ 90 วินาที สำหรับ Scanned PDF (p95)
- **SC-002**: RAG Q&A ตอบกลับภายใน 10 วินาที (p95 นับจาก dequeue จาก `ai-realtime`)
- **SC-003**: VRAM peak ไม่เกิน 5GB เมื่อรัน 2 models พร้อมกัน (gemma4:e4b + nomic-embed-text)
- **SC-004**: ไม่มี data leak ข้ามโครงการใน RAG — ทุก Qdrant query มี `project_public_id` filter (ตรวจสอบได้จาก query log)
- **SC-005**: Legacy Migration Batch 20,000 ฉบับ ประมวลผลสำเร็จโดยไม่มี duplicate record (ตรวจสอบด้วย Idempotency-Key)
- **SC-006**: admin_override_rate < 40% หลัง Calibration Phase (100-500 ฉบับแรก)
- **SC-007**: ไม่มี Typhoon Cloud API ปรากฏใน codebase หลัง implementation (ตรวจสอบด้วย grep)
- **SC-008**: ai_audit_logs ทุก record มี confidence_score และ model_name ไม่เป็น null

---

## Assumptions

- Desk-5439 พร้อมใช้งานและมี Ollama ที่ติดตั้ง `gemma4:e4b Q8_0` และ `nomic-embed-text` แล้ว
- Qdrant instance พร้อมใช้งานและ accessible จาก NestJS backend
- n8n instance สามารถ call DMS API ผ่าน HTTP ได้
- PaddleOCR ติดตั้งบน Desk-5439 พร้อมรองรับภาษาไทย
- `OCR_CHAR_THRESHOLD` default = 100 chars ต่อหน้า (ปรับได้ผ่าน .env)
- เอกสาร Legacy อยู่ใน Folder ที่ n8n เข้าถึงได้

## Clarifications

### Session 2026-05-15
- Q: RAG embedding scope — embed ทั้งฉบับหรือแค่ 3 หน้า? → A: ทั้งฉบับ (chunked 512t/64t overlap) — 3-page limit ใช้เฉพาะ Classification/Tagging
- Q: embed-document trigger timing → A: AUTO ทันทีหลัง commit (parallel กับ AI Suggestion), ไม่รอ Human confirm
- Q: n8n role → A: n8n call DMS API เท่านั้น (`POST /api/ai/jobs`) — ไม่เรียก Ollama/Qdrant โดยตรง
- Q: QdrantService enforcement → A: `projectPublicId: string` เป็น required param — ไม่มี optional fallback
- Q: OCR scope → A: Auto-detect ทั้ง Legacy และ New Uploads ด้วย PyMuPDF
