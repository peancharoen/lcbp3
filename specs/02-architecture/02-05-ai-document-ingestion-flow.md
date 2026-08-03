# 02.5 AI Document Ingestion Flow (เส้นทางการนำเอกสารเข้าระบบ — ส่วนที่เกี่ยวกับ AI)

---

**title:** 'AI Document Ingestion Flow'
**version:** 1.2.0
**status:** active
**owner:** Nattanin Peancharoen
**last_updated:** 2026-08-03
**source:** migrated from `docs/AI-step.md` (reconciled against actual code + ADR-040; ADR-035↔ADR-040 drift formally closed by ADR-043)
**related:**

- specs/06-Decision-Records/ADR-043-ai-architecture-current-state.md  ← ⭐ **Single Source of Truth สำหรับสถาปัตยกรรม AI ทั้งหมด** (อ่านที่นี่ก่อน)
- specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md  ← **Source of Truth สำหรับ OCR sidecar contract** (amends ADR-035 — ประกาศอย่างเป็นทางการโดย ADR-043)
- specs/06-Decision-Records/ADR-042-sandbox-project-and-ocr-text-persistence.md
- specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md
- specs/06-Decision-Records/ADR-036-unified-ocr-architecture.md  ← §5 amended by ADR-040 (ประกาศอย่างเป็นทางการโดย ADR-043)
- specs/06-Decision-Records/ADR-035-ai-pipeline-flow-architecture.md  ← amended by ADR-040 (drift ปิดแล้วโดย ADR-043 — ดูด้านล่าง)
- specs/06-Decision-Records/ADR-016-security-authentication.md
- specs/06-Decision-Records/ADR-008-email-notification-strategy.md
- specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md

---

> **หมายเหตุการ reconciliation:**
> เอกสารนี้ย้ายมาจาก `docs/AI-step.md` และปรับให้สะท้อน **โค้ดจริงใน production** (ตรวจวันที่ 2026-07-30; drift reconciliation 2026-08-03)
>
> **Source of Truth แบ่งตามชั้น:**
> - ⭐ **AI Architecture ทั้งหมด (Single Source of Truth):** ADR-043 (2026-08-03) — restatement ของ ADR ที่ active ทั้งหมด + ปิด drift ADR-035 ↔ ADR-040 อย่างเป็นทางการ
> - **OCR sidecar contract (engine selection, /normalize removal, runtime params):** ADR-040 (2026-06-20)
> - **OCR text persistence + Sandbox Project:** ADR-042
> - **AI boundary + Qdrant projectPublicId filter:** ADR-023A (restated ใน ADR-043 §1)
> - **Two-Phase File Upload:** ADR-016
>
> ✅ **ADR-035 ↔ ADR-040 drift — ปิดแล้วอย่างเป็นทางการ:** ADR-043 (2026-08-03) ประกาศอย่างเป็นทางการว่า ADR-040 amends ADR-035 (ในส่วน D1/D2: Tesseract fallback, `/normalize` endpoint, engine `typhoon-np-dms-ocr:latest`) และ amends ADR-036 §5 — drift note เดิมที่ระบุว่า "ADR-040 ยังไม่ได้ประกาศ Amends อย่างเป็นทางการ" **ถูกปิดแล้ว** ให้อ้างอิง ADR-043 Decision Graph และ "What is current" table สำหรับสถานะปัจจุบัน

## ภาพรวม

มี 2 เส้นทางหลัก: **Production Flow** (เอกสารจริง) และ **Sandbox Flow** (ทดสอบใน Admin Console)

---

## 1. Production Flow: สร้าง → Submit → RAG Prepare

### Phase 1: Frontend — อัปโหลดไฟล์ + สร้าง Correspondence

**Two-Phase File Upload (ADR-016):**

1. ผู้ใช้เลือกไฟล์ในฟอร์ม (`FileUploadZone` รองรับ `.pdf`, `.dwg`, `.docx`, `.xlsx`, `.zip`)
2. ไฟล์ถูกอัปโหลดไป `POST /files/upload` → ได้ `tempId` กลับมา (ยังไม่ถาวร)
3. ส่ง `CreateCorrespondenceDto` ไป `POST /correspondences` พร้อม `attachmentTempIds[]`

> **อ้างอิงโค้ด:** ฟังก์ชัน upload ในส่วน Phase 1 ของฟอร์ม Correspondence (`frontend/components/correspondences/form.tsx`) — เรียก `filesApi.uploadMany(validFiles)` แล้ว map เป็น `attachmentTempIds`

### Phase 2: Backend — บันทึก + Commit ไฟล์

`CorrespondenceService.create()` ทำงานใน transaction:

1. สร้าง `Correspondence` + `CorrespondenceRevision`
2. **Commit ไฟล์จาก Temp → Permanent** ผ่าน `fileStorageService.commit()`
3. สร้าง junction `CorrespondenceRevisionAttachment` เชื่อม revision ↔ attachment
4. Commit transaction

> **อ้างอิงโค้ด:** เมธอด `CorrespondenceService.create()` — บล็อก "Commit attachments from Temp → Permanent (Two-Phase Storage)" เรียก `this.fileStorageService.commit(createDto.attachmentTempIds, ...)`

### Phase 3: Submit Workflow → Trigger RAG Prepare

เมื่อผู้ใช้กด Submit (`POST /correspondences/:uuid/submit`):

1. `CorrespondenceWorkflowService.submitWorkflow()` สร้าง Workflow Instance และ process transition `SUBMIT`
2. `syncStatus()` อัปเดตสถานะ revision
3. **หลัง commit transaction** → เรียก `triggerRagPrepare()` (fire-and-forget, non-critical)

> **อ้างอิงโค้ด:** เมธอด `CorrespondenceWorkflowService.submitWorkflow()` — หลัง `queryRunner.commitTransaction()` ถ้า `transitionResult.nextState !== 'DRAFT'` จะเรียก `this.triggerRagPrepare(revision, transitionResult.nextState)`

`triggerRagPrepare()` รวบรวมข้อมูล (projectPublicId, correspondenceNumber, docType, attachmentPath, **attachmentPublicId**) แล้ว enqueue `rag-prepare` job เข้า **BullMQ `ai-batch` queue** (ADR-008):

> **อ้างอิงโค้ด:** เมธอด `triggerRagPrepare()` เรียก `this.aiQueueService.enqueueRagPrepare({ documentPublicId, projectPublicId, correspondenceNumber, docType, statusCode, revisionNumber, subject, documentDate, attachmentPath })`

---

## 2. AI Pipeline (BullMQ Worker)

เมื่อ `rag-prepare` job ถูก dequeue:

### Step A: OCR Text Extraction + Persist (ADR-042)

`processRagPrepare()` เรียก `OcrService.detectAndExtract()`:

> **อ้างอิงโค้ด:** เมธอด `AiBatchProcessor.processRagPrepare()` — เรียก `this.ocrService.detectAndExtract({ pdfPath: attachmentPath, activeProfile: data.effectiveProfile })` แล้วเก็บผลใน `cachedOcrText`

#### OCR Engine — ตามโค้ดจริง + ADR-040 D1

| จริงในโค้ด | ADR-035 (ล้าสมัย) | ADR-040 (Source of Truth) |
|---|---|---|
| **Engine เดียว: `np-dms-ocr`** (Typhoon OCR via Ollama) | อ้าง PRIMARY = `typhoon-np-dms-ocr` + FALLBACK = Tesseract | "Engine selection: ไม่ต้องมีแล้ว — ใช้ `np-dms-ocr` ตัวเดียว" |
| ไม่มี Tesseract | มี Tesseract fallback | ไม่มี |
| มี PyMuPDF `auto` branch ใน sidecar (dead code สำหรับ PDF scan) | "ยกเลิก PyMuPDF Fast-Path" | "Fast-path decision (PyMuPDF chars > 100 → fast path): คงไว้ใน sidecar" |

**พฤติกรรมจริงสำหรับเอกสาร LCBP3 (PDF scan ทั้งหมด):**

1. Backend `OcrService.detectAndExtract()`:
   - ถ้า `extractedChars > threshold` → return ตรงๆ (ใช้ text ที่ extract มาแล้ว)
   - ถ้ามี `pdfPath` → เลือกระหว่าง `processWithNpDmsOcr` / `processWithFastPath` ตาม `getActiveEngineId()`
   - ในทางปฏิบัติ `processWithNpDmsOcr` ส่ง `engine='np-dms-ocr'` ไป sidecar
2. Sidecar `_process_pdf_doc(engine='np-dms-ocr')`:
   - ข้าม branch `auto` (PyMuPDF text extraction) โดยตรง
   - วนเรียก `process_ocr()` ทุกหน้า → Ollama `np-dms-ocr:latest` → text
3. **VRAM ไม่พอ / Ollama fail** → backend fallback ไป `processWithFastPath` (ส่ง `engine='auto'`) → sidecar ลอง PyMuPDF (PDF scan ได้ ~0 chars) → ตกไป branch "Unknown engine 'auto'" → วิ่ง `np-dms-ocr` อีกรอบ
   - ⚠️ **Code smell (ไม่ใช่จุดบกพร่องการทำงาน):** Fallback path วนกลับมา np-dms-ocr อีกครั้ง — ควร clean up ให้ `auto` ตรงไป np-dms-ocr เลย (อยู่ใน scope ของ ADR-040 T001–T014)

> **หมายเหตุ PDF scan:** เอกสาร LCBP3 เป็น image scan ทั้งหมด (ไม่ใช่ print-to-PDF) ดังนั้น PyMuPDF `page.get_text()` จะได้ ~0 chars → fast path ไม่ trigger ในทางปฏิบัติ — branch นี้เป็น dead code สำหรับ corpus จริง แต่ ADR-040 D1 ตัดสินใจคงไว้ (เผื่อกรณี PDF มี text layer ในอนาคต)

**ADR-042: Persist OCR text ก่อนเสมอ** — หลัง OCR สำเร็จ ระบบบันทึก `attachments.ocr_text` ก่อน enqueue embedding job:

> **อ้างอิงโค้ด:** `AiBatchProcessor.processRagPrepare()` — เรียก `this.attachmentRepo.update({ publicId: attachmentPublicId }, { ocrText: cachedOcrText })` ก่อนเสมอ

จากนั้น enqueue `embed-document` job แยกจาก `rag-prepare` เพื่อให้ retry ไม่ต้องรัน OCR ซ้ำ:

> **อ้างอิงโค้ด:** `AiBatchProcessor.processRagPrepare()` — เรียก `this.aiQueueService.enqueueEmbedDocument({ documentPublicId, projectPublicId, ..., extractedText: cachedOcrText })`

### Step B: Semantic Chunking + Embedding (embed-document job)

เมื่อ `embed-document` job ถูก dequeue รับ `extractedText` มาโดยตรง ข้าม OCR ซ้ำ:

1. **Semantic Chunking** — ใช้ LLM (`np-dms-ai` ตาม ADR-034) + prompt template จาก `ai_prompts` (ADR-030) แบ่งข้อความเป็น chunks ตาม topic
   - Fallback: แบ่งแบบ fixed-size (512 tokens, 64 overlap) ถ้า LLM ล้มเหลว

2. **Embedding** — แต่ละ chunk ส่งไป Sidecar `POST /embed` → **BGE-M3** (`BAAI/bge-m3`) สร้าง **Hybrid vector** (Dense 1024 dims + Sparse)
   - ✅ ยืนยันมีจริงใน sidecar: `_load_bge_models()` โหลด `BGEM3FlagModel('BAAI/bge-m3')` + `FlagReranker('BAAI/bge-reranker-large')`
   - Dynamic CPU/GPU selection ผ่าน `.to(device)` (ADR-040 D5 — LLM-First GPU Ownership + CPU Fallback Retrieval)

3. **Qdrant Upsert** — ลบ points เก่า → upsert points ใหม่ พร้อม payload 11 fields:
   - `doc_public_id`, `project_public_id`, `doc_number`, `doc_type`, `status_code`
   - `revision_number`, `subject`, `document_date`, `chunk_topic`, `chunk_index`, `chunk_text`

> **อ้างอิงโค้ด:** เมธอด `EmbeddingService.embedDocument()` — เรียก `semanticChunkTextWithFallback(ocrText)` แล้ว loop สร้าง points ผ่าน `ocrService.embedViaSidecar(chunk.text)` จากนั้น `qdrantService.deleteByDocumentPublicId(projectPublicId, documentPublicId)` + `qdrantService.upsert(projectPublicId, points)` พร้อม vector `{ bge_dense, bge_sparse }`
>
> **ADR-023A enforcement:** ทุก Qdrant call ต้องส่ง `projectPublicId` เป็นพารามิเตอร์บังคับ (multi-tenant isolation)

### Step C: Audit Log

บันทึก `ai_audit_logs` พร้อม model, processing time, device (GPU/CPU), status — ตาม ADR-023/023A audit trail requirement

---

## 3. Sandbox Flow (Admin Console)

มี 2 รูปแบบที่ทำงานคู่ขนานกัน (แยกขากันตาม ADR-042): **Production Pipeline Sandbox** (ทดสอบแยกส่วน, ไม่ commit DB — ตาม ADR-036) และ **Sandbox Project** (ทดสอบ Full Pipeline แบบ commit DB จริง — ตาม ADR-042)

### 3.1 Production Pipeline Sandbox (ADR-036 — คงเดิม, ไม่กระทบ DB)

สำหรับ Superadmin ทดสอบ AI แบบไม่บันทึกลง DB แบ่งเป็น 3 ขั้นตอน:

| Step | Endpoint | การทำงาน |
|------|----------|----------|
| **1. OCR Only** | `POST /ai/admin/sandbox/ocr` | อัปโหลด PDF → OCR เท่านั้น (engine `np-dms-ocr`) → cache ผลใน Redis |
| **2. AI Extract** | `POST /ai/admin/sandbox/ai-extract` | ใช้ OCR text จาก cache → ส่งให้ LLM (`np-dms-ai`) สกัด metadata เป็น JSON |
| **3. RAG Prep** | `POST /ai/admin/sandbox/rag-prep` | รับ OCR text → semantic chunking + embedding preview (ไม่ upsert Qdrant) |

Frontend (`SandboxTabs.tsx`) ใช้ polling ทุก 2 วินาที เพื่อเช็คสถานะ job ผ่าน `GET /ai/admin/sandbox/job/:id`

### 3.2 Sandbox Project (ADR-042)

Superadmin ทดสอบ Production Flow แบบ end-to-end ผ่าน Sandbox Project (project_code: SANDBOX) ที่แยกจากข้อมูลจริง:

1. อัปโหลดไฟล์ → `POST /files/upload`
2. สร้าง Correspondence → `POST /correspondences` (ด้วย sandbox projectPublicId)
3. Submit → `POST /correspondences/:uuid/submit`
4. ระบบเดินโค้ด production จริง: OCR → persist `ocr_text` → `embed-document` → Qdrant upsert
5. Superadmin ตรวจสอบผลลัพธ์ OCR text และ embedding status
6. กด "Clear Sandbox Data" → `POST /ai/admin/sandbox/clear-data` → cascade delete (scoped `WHERE project_id = sandboxProjectId`) + vector deletion

**RBAC (ADR-042):**
- ผู้ใช้ทั่วไปไม่เห็น Sandbox Project ใน `GET /projects` (กรอง `is_sandbox = false` เสมอ)
- ผู้ใช้ทั่วไปไม่สามารถสร้าง Correspondence ใน Sandbox Project ได้ (guard ใน `CorrespondenceService.create()`)
- ไม่สามารถเปลี่ยน `is_active` ของ Sandbox Project ได้ (guard ใน `ProjectService.update()`)

> **สรุปความต่าง:**
> | แนวคิด | Commit DB? | ทดสอบอะไร |
> |---|---|---|
> | Production Pipeline Sandbox (ADR-036) | ❌ ไม่ | OCR + LLM extraction เท่านั้น |
> | Sandbox Project (ADR-042) | ✅ scoped | Production Flow ทั้ง 3 phase + AI Pipeline ทั้ง 2 step แบบ end-to-end |

---

## ภาพรวม Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                            │
│                                                                     │
│  1. เลือกไฟล์ → POST /files/upload → tempId                         │
│  2. POST /correspondences (พร้อม attachmentTempIds)                 │
│  3. POST /correspondences/:uuid/submit                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│ BACKEND (NestJS)                                                    │
│                                                                     │
│  CorrespondenceService.create()                                     │
│    → commit temp files → permanent                                  │
│    → save CorrespondenceRevision + Attachment links                 │
│                                                                     │
│  CorrespondenceWorkflowService.submitWorkflow()                     │
│    → WorkflowEngine.processTransition("SUBMIT")                     │
│    → syncStatus()                                                   │
│    → triggerRagPrepare() ──► enqueue BullMQ "rag-prepare"          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│ BULLMQ WORKER (ai-batch.processor.ts)                              │
│                                                                     │
│  processRagPrepare()                                                │
│    │                                                                │
│    ├─► OcrService.detectAndExtract()                                │
│    │     └─► POST sidecar /ocr-upload (engine="np-dms-ocr")        │
│    │         └─► Ollama np-dms-ocr:latest → raw OCR text            │
│    │     ⚠️ ไม่มี Tesseract (ADR-040 D1)                              │
│    │     ⚠️ PyMuPDF "auto" branch เป็น dead code สำหรับ PDF scan     │
│    │                                                                │
│    ├─► persist ocr_text → attachments.ocr_text (ADR-042)            │
│    │                                                                │
│    └─► enqueue "embed-document" job (extractedText = ocrText)       │
│                                                                     │
│  embed-document job:                                                │
│    ├─► EmbeddingService.embedDocument()                             │
│    │     ├─ Semantic Chunking (np-dms-ai + ai_prompts)              │
│    │     │   └─ fallback → fixed-size chunk (512 tokens, 64 overlap)│
│    │     ├─ Sidecar /embed → BGE-M3 Dense + Sparse vectors         │
│    │     │   (CPU/GPU dynamic — ADR-040 D5)                         │
│    │     └─ Qdrant upsert (projectPublicId filter — ADR-023A)      │
│    │                                                                │
│    └─► saveAiAuditLog() → ai_audit_logs                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## OCR Sidecar Endpoints (ตามโค้ดจริง + ADR-040)

| Endpoint | มีจริง | หน้าที่ | ADR อ้างอิง |
|---|---|---|---|
| `POST /ocr` | ✅ | OCR via Ollama `np-dms-ocr` (รับ `pdfPath`) | ADR-040 D7 (path whitelist) |
| `POST /ocr-upload` | ✅ | OCR via Ollama `np-dms-ocr` (รับ multipart file) | ใช้ใน production flow |
| `POST /embed` | ✅ | BGE-M3 embedding (Dense + Sparse) | ADR-040 D5 (CPU/GPU dynamic) |
| `POST /rerank` | ✅ | BGE-Reranker-Large reranking | ADR-040 D5 |
| `POST /normalize` | ❌ ลบแล้ว | (เคยมี — ADR-040 D2 ลบเพราะไม่มี consumer) | ADR-040 D2 + T010 |
| `GET /health` | ✅ | Health check (returns `"engine": "np-dms-ocr"`) | — |

---

## Key ADRs ที่เกี่ยวข้อง

| ADR | หัวข้อ | บทบาทใน Flow นี้ | สถานะเอกสาร |
|---|---|---|---|
| ⭐ **ADR-043** | AI Architecture — Current State (Single Source of Truth) | **Entry point ก่อน ADR อื่น** — restatement ของ ADR ที่ active ทั้งหมด + ปิด drift ADR-035 ↔ ADR-040 | Accepted |
| **ADR-040** | OCR Sidecar Refactor | **Source of Truth ของ OCR sidecar contract** — engine selection, /normalize removal, runtime params, security (amends ADR-035 + ADR-036 §5 — ประกาศอย่างเป็นทางการโดย ADR-043) | Accepted (Phase 1 + 2 implemented) |
| **ADR-042** | Sandbox Project + OCR Text Persistence | แยก `rag-prepare` เป็น OCR-persist + `embed-document`; Sandbox Project สำหรับ Full Pipeline Testing | Proposed |
| **ADR-023/023A** | Unified AI Architecture | AI boundary (Ollama บน `np-dms-lcbp3` ตาม ADR-041), Qdrant `projectPublicId` filter, BullMQ 2-queue | Accepted |
| **ADR-036** | Unified OCR Architecture | นิยาม Production Pipeline Sandbox (3 step, ไม่ commit DB) — §5 amended by ADR-040 | Accepted (§5 amended) |
| **ADR-034** | AI Model Change (Thai-Optimized Stack) | โมเดล `np-dms-ai` + `np-dms-ocr` + BGE-M3 + BGE-Reranker | Accepted |
| **ADR-035** | AI Pipeline Flow Architecture | เคยเป็น flow SoT — **ถูก amend บางส่วนโดย ADR-040** (Tesseract, /normalize, engine name) — **drift ปิดแล้วอย่างเป็นทางการโดย ADR-043** | Accepted (amended by ADR-040) |
| **ADR-030** | Context-Aware Prompt Templates | prompt template ดึงจาก `ai_prompts` table | Accepted |
| **ADR-016** | Security & Authentication | Two-Phase File Upload (Temp → Commit) | Accepted |
| **ADR-008** | Email/Notification Strategy | BullMQ for background jobs (ไม่ inline) | Accepted |
| **ADR-019** | Hybrid Identifier Strategy | ใช้ `publicId` (UUIDv7) ในทุก API response + payload key | Accepted |

---

## Change Log

- **2026-08-03 v1.2.0:** Reconcile กับ ADR-043 (AI Architecture Current State — Single Source of Truth) — เพิ่ม ADR-043 เป็น entry point ใน related list + SoT แบ่งตามชั้น; ปิด drift note ADR-035 ↔ ADR-040 อย่างเป็นทางการ (ADR-043 ประกาศ ADR-040 amends ADR-035 + ADR-036 §5); อัปเดตสถานะ ADR-040 เป็น Accepted (Phase 1+2 implemented); แก้ host ref "Admin Desktop" → `np-dms-lcbp3` (ADR-041); แก้ model name `typhoon2.5-np-dms` → `np-dms-ai` (ADR-034)
- **2026-07-30 v1.1.0:** Reconcile กับโค้ดจริง + ใช้ ADR-040 เป็น Source of Truth ของ OCR sidecar contract (แทน ADR-035) — ลบ Tesseract, ลบ `/normalize`, ระบุ engine เดียว `np-dms-ocr`, อธิบาย PyMuPDF `auto` branch ว่าเป็น dead code สำหรับ PDF scan (ไม่ใช่ "ยกเลิก"), ยืนยัน BGE-M3 + BGE-Reranker มีใน sidecar จริง, เพิ่ม drift note ชี้ไป ADR-035
- **2026-07-30 v1.0.0:** นำเข้าจาก `docs/AI-step.md` พร้อม reconcile กับ ADR-035/023A/042 — ตัด label "ใหม่", แปลง code citation เป็น function-level, ปรับ OCR routing ตาม ADR-035, เพิ่ม cross-link + drift flag
