# สรุปขั้นตอนการนำเอกสารเข้าระบบ (Frontend → Backend) — ส่วนที่เกี่ยวกับ AI

## ภาพรวม

มี 2 เส้นทางหลัก: **Production Flow** (เอกสารจริง) และ **Sandbox Flow** (ทดสอบใน Admin Console)

---

## 1. Production Flow: สร้าง → Submit → RAG Prepare

### Phase 1: Frontend — อัปโหลดไฟล์ + สร้าง Correspondence

**Two-Phase File Upload (ADR-016):**

1. ผู้ใช้เลือกไฟล์ในฟอร์ม (`FileUploadZone` รองรับ `.pdf`, `.dwg`, `.docx`, `.xlsx`, `.zip`)
2. ไฟล์ถูกอัปโหลดไป `POST /files/upload` → ได้ `tempId` กลับมา (ยังไม่ถาวร)
3. ส่ง `CreateCorrespondenceDto` ไป `POST /correspondences` พร้อม `attachmentTempIds[]`

```
@/opt/np-dms-lcbp3/frontend/components/correspondences/form.tsx:311-331
// Phase 1: Upload attachments to temp storage
const uploaded = await filesApi.uploadMany(validFiles);
attachmentTempIds = uploaded.map((u) => u.tempId);
```

### Phase 2: Backend — บันทึก + Commit ไฟล์

`CorrespondenceService.create()` ทำงานใน transaction:

1. สร้าง `Correspondence` + `CorrespondenceRevision`
2. **Commit ไฟล์จาก Temp → Permanent** ผ่าน `fileStorageService.commit()`
3. สร้าง junction `CorrespondenceRevisionAttachment` เชื่อม revision ↔ attachment
4. Commit transaction

```
@/opt/np-dms-lcbp3/backend/src/modules/correspondence/correspondence.service.ts:391-418
// Commit attachments from Temp → Permanent (Two-Phase Storage)
const committed = await this.fileStorageService.commit(createDto.attachmentTempIds, ...);
```

### Phase 3: Submit Workflow → Trigger RAG Prepare

เมื่อผู้ใช้กด Submit (`POST /correspondences/:uuid/submit`):

1. `CorrespondenceWorkflowService.submitWorkflow()` สร้าง Workflow Instance และ process transition `SUBMIT`
2. `syncStatus()` อัปเดตสถานะ revision
3. **หลัง commit transaction** → เรียก `triggerRagPrepare()` (fire-and-forget, non-critical)

```
@/opt/np-dms-lcbp3/backend/src/modules/correspondence/correspondence-workflow.service.ts:99-112
await queryRunner.commitTransaction();
// After-commit: RAG preparation (fire-and-forget)
if (transitionResult.nextState !== 'DRAFT') {
  await this.triggerRagPrepare(revision, transitionResult.nextState);
}
```

`triggerRagPrepare()` รวบรวมข้อมูล (projectPublicId, correspondenceNumber, docType, attachmentPath, **attachmentPublicId**) แล้ว enqueue `rag-prepare` job เข้า **BullMQ `ai-batch` queue**:

```
@/opt/np-dms-lcbp3/backend/src/modules/correspondence/correspondence-workflow.service.ts:279-291
await this.aiQueueService.enqueueRagPrepare({
  documentPublicId: correspondence.publicId,
  projectPublicId: projectPublicId,
  correspondenceNumber, docType, statusCode,
  revisionNumber, subject, documentDate, attachmentPath,
});
```

---

## 2. AI Pipeline (BullMQ Worker — `ai-batch.processor.ts`)

เมื่อ `rag-prepare` job ถูก dequeue:

### Step A: OCR Text Extraction + Persist (ADR-042)

`processRagPrepare()` เรียก [OcrService.detectAndExtract()](cci:1://file:///opt/np-dms-lcbp3/backend/src/modules/ai/services/ocr.service.ts:325:2-348:3):

```
@/opt/np-dms-lcbp3/backend/src/modules/ai/processors/ai-batch.processor.ts:986-995
const ocrResult = await this.ocrService.detectAndExtract({
  pdfPath: attachmentPath,
  activeProfile: data.effectiveProfile,
});
cachedOcrText = ocrResult.text;
```

**OCR Auto-Detect Logic** (`@/opt/np-dms-lcbp3/backend/src/modules/ai/services/ocr.service.ts:327-349`):

- ถ้า PDF มี text layer > 100 chars → **Fast Path** (PyMuPDF ส่งไฟล์ไป sidecar `/ocr-upload`)
- ถ้า text layer < 100 chars → เลือก engine ตาม config:
  - **Fast Path** (PyMuPDF) — ค่าเริ่มต้น
  - **np-dms-ocr** (Ollama model) — ตรวจสอบ VRAM ก่อน ถ้าไม่พอ fallback ไป Fast Path

**ADR-042: Persist OCR text ก่อนเสมอ** — หลัง OCR สำเร็จ ระบบบันทึก `attachments.ocr_text` ก่อน enqueue embedding job:

```
@/opt/np-dms-lcbp3/backend/src/modules/ai/processors/ai-batch.processor.ts:1014-1030
await this.attachmentRepo.update(
  { publicId: attachmentPublicId },
  { ocrText: cachedOcrText }
);
```

จากนั้น enqueue `embed-document` job แยกจาก `rag-prepare` เพื่อให้ retry ไม่ต้องรัน OCR ซ้ำ:

```
@/opt/np-dms-lcbp3/backend/src/modules/ai/processors/ai-batch.processor.ts:1036-1047
await this.aiQueueService.enqueueEmbedDocument({
  documentPublicId, projectPublicId, ...,
  extractedText: cachedOcrText,
});
```

### Step B: Semantic Chunking + Embedding (embed-document job)

เมื่อ `embed-document` job ถูก dequeue รับ `extractedText` มาโดยตรง ข้าม OCR ซ้ำ:

1. **Semantic Chunking** — ใช้ LLM (np-dms-ai) + prompt `rag_chunking` แบ่งข้อความเป็น chunks ตาม topic
   - Fallback: แบ่งแบบ fixed-size (512 tokens, 64 overlap) ถ้า LLM ล้มเหลว

2. **Embedding** — แต่ละ chunk ส่งไป sidecar `/embed` เพื่อสร้าง **BGE-M3 Hybrid vector** (Dense 1024 dims + Sparse)

3. **Qdrant Upsert** — ลบ points เก่า → upsert points ใหม่ พร้อม payload 11 fields:
   - `doc_public_id`, `project_public_id`, `doc_number`, `doc_type`, `status_code`
   - `revision_number`, `subject`, `document_date`, `chunk_topic`, `chunk_index`, `chunk_text`

```
@/opt/np-dms-lcbp3/backend/src/modules/ai/services/embedding.service.ts:80-131
const chunks = await this.semanticChunkTextWithFallback(ocrText);
for (const [idx, chunk] of chunks.entries()) {
  const embedResult = await this.ocrService.embedViaSidecar(chunk.text);
  points.push({ id: `${documentPublicId}-${idx}`, vector: { bge_dense, bge_sparse }, payload: {...} });
}
await this.qdrantService.deleteByDocumentPublicId(projectPublicId, documentPublicId);
await this.qdrantService.upsert(projectPublicId, points);
```

### Step C: Audit Log

บันทึก `ai_audit_logs` พร้อม model, processing time, device (GPU/CPU), status

---

## 3. Sandbox Flow (Admin Console)

มี 2 รูปแบบ: **Production Pipeline Sandbox** (ทดสอบแยกส่วน, ไม่ commit DB) และ **Sandbox Project** (ทดสอบ Full Pipeline แบบ commit DB จริง, ADR-042)

### 3.1 Production Pipeline Sandbox (เดิม — ไม่กระทบ)

สำหรับ Superadmin ทดสอบ AI แบบไม่บันทึกลง DB แบ่งเป็น 3 ขั้นตอน:

| Step | Endpoint | การทำงาน |
|------|----------|----------|
| **1. OCR Only** | `POST /ai/admin/sandbox/ocr` | อัปโหลด PDF → OCR เท่านั้น (ไม่เรียก LLM) → cache ผลใน Redis |
| **2. AI Extract** | `POST /ai/admin/sandbox/ai-extract` | ใช้ OCR text จาก cache → ส่งให้ LLM (np-dms-ai) สกัด metadata เป็น JSON |
| **3. RAG Prep** | `POST /ai/admin/sandbox/rag-prep` | รับ OCR text → semantic chunking + embedding preview (ไม่ upsert Qdrant) |

Frontend (`SandboxTabs.tsx`) ใช้ polling ทุก 2 วินาที เพื่อเช็คสถานะ job ผ่าน `GET /ai/admin/sandbox/job/:id`

### 3.2 Sandbox Project (ADR-042 — ใหม่)

Superadmin ทดสอบ Production Flow แบบ end-to-end ผ่าน Sandbox Project (project_code: SANDBOX) ที่แยกจากข้อมูลจริง:

1. อัปโหลดไฟล์ → `POST /files/upload`
2. สร้าง Correspondence → `POST /correspondences` (ด้วย sandbox projectPublicId)
3. Submit → `POST /correspondences/:uuid/submit`
4. ระบบเดินโค้ด production จริง: OCR → persist ocr_text → embed-document → Qdrant upsert
5. Superadmin ตรวจสอบผลลัพธ์ OCR text และ embedding status
6. กด "Clear Sandbox Data" → `POST /ai/admin/sandbox/clear-data` → cascade delete + vector deletion

**RBAC:**
- ผู้ใช้ทั่วไปไม่เห็น Sandbox Project ใน `GET /projects` (กรอง `isSandbox = false` เสมอ)
- ผู้ใช้ทั่วไปไม่สามารถสร้าง Correspondence ใน Sandbox Project ได้ (guard ใน `CorrespondenceService.create()`)
- ไม่สามารถเปลี่ยน `is_active` ของ Sandbox Project ได้ (guard ใน `ProjectService.update()`)

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
│    │     ├─ text layer > 100 chars? → Fast Path (PyMuPDF)          │
│    │     └─ text layer < 100 chars? → np-dms-ocr (Ollama)          │
│    │         └─ VRAM ไม่พอ? → fallback Fast Path                   │
│    │                                                                │
│    ├─► EmbeddingService.embedDocument()                             │
│    │     ├─ Semantic Chunking (LLM np-dms-ai + prompt rag_chunking)│
│    │     │   └─ fallback → fixed-size chunk (512 tokens, 64 overlap)│
│    │     ├─ Sidecar /embed → BGE-M3 Dense + Sparse vectors         │
│    │     └─ Qdrant upsert (projectPublicId filter — ADR-023A)      │
│    │                                                                │
│    └─► saveAiAuditLog() → ai_audit_logs                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Key ADRs ที่เกี่ยวข้อง

- **ADR-016**: Two-Phase File Upload (Temp → Commit)
- **ADR-023/023A**: AI boundary (Ollama on Admin Desktop only, Qdrant `projectPublicId` filter)
- **ADR-008**: BullMQ for background jobs (ไม่ inline)
- **ADR-034**: Model switching (np-dms-ai ↔ np-dms-ocr)
- **ADR-019**: ใช้ `publicId` (UUIDv7) ในทุก API response
- **ADR-042**: OCR Text Persistence & Sandbox Project — แยก rag-prepare เป็น OCR-persist + embed-document, Sandbox Project สำหรับ Full Pipeline Testing
