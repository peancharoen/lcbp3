# ADR-035: AI Pipeline Flow Architecture

**Status:** Accepted
**Date:** 2026-06-05
**Decision Makers:** Development Team, AI Integration Lead
**Supersedes:** ADR-034 Section 2 (Implementation Details — Model Switching Logic)
**Related Documents:**
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-030: Context-Aware Prompt Templates](./ADR-030-context-aware-prompt-templates.md)
- [ADR-033: Active Model & OCR Management](./ADR-033-active-model-and-ocr-management.md)
- [ADR-034: AI Model Change — Thai-Optimized Stack](./ADR-034-AI-model-change.md)

---

## Context and Problem Statement

ระบบ AI ของ LCBP3 ใช้โมเดลหลายตัว (ตาม ADR-034) แต่ยังไม่มีเอกสารกำหนด **flow** การทำงานของแต่ละ use case อย่างชัดเจน เช่น:
- Sandbox ทดสอบ prompt ใช้โมเดลอย่างไร
- n8n migration และ user upload ต่างกันอย่างไร
- RAG embedding เกิดขึ้น ณ จุดใด
- BullMQ job type ใดที่ map กับ use case ใด

---

## Decision Drivers

- **Single Entry Point for OCR:** OCR ทุกประเภทต้องผ่าน OCR Sidecar (port 8765) เท่านั้น
- **No PyMuPDF Fast-Path:** ยกเลิก PyMuPDF text layer extraction — ใช้เฉพาะ Typhoon OCR (primary) และ Tesseract (fallback)
- **BullMQ as Gateway:** ทุก AI inference ต้องผ่าน BullMQ — ห้าม call Ollama หรือ Sidecar โดยตรงจาก API controller
- **Prompt Template จาก DB:** prompt ที่ใช้ใน Extract และ RAG Prep ต้องดึงจาก `ai_prompts` table ทุกครั้ง (ADR-030)
- **Human-in-the-loop:** AI output ทุกตัวต้องผ่านการยืนยันจากมนุษย์ก่อน commit ลง DB (ADR-023)

---

## Decision Outcome

### โมเดลและหน้าที่

| โมเดล | หน้าที่ | keep_alive | เรียกผ่าน |
|-------|---------|------------|-----------|
| `typhoon-np-dms-ocr:latest` | OCR ดึงข้อความดิบจาก PDF/image | `0` (unload ทันที) | OCR Sidecar → Ollama |
| Tesseract | OCR fallback (เมื่อ Typhoon OCR ล้มเหลว) | — | OCR Sidecar |
| `typhoon2.5-np-dms:latest` | (1) Extract metadata, (2) Semantic Chunking + RAG prep, (3) Q&A | Standby ตลอด | BullMQ → OllamaService |
| `BGE-M3` (BAAI/bge-m3) | Embedding vectors → Qdrant (Dense 1024 + Sparse) | — | OCR Sidecar (CPU RAM) |
| `BGE-Reranker-Large` | Re-rank RAG results ก่อนส่ง LLM | — | OCR Sidecar (CPU RAM) |

**หมายเหตุ:** `nomic-embed-text` ถูกแทนที่โดย `BGE-M3` + `BGE-Reranker-Large` (Grill G1) เพราะรองรับ Thai multilingual ได้ดีกว่าและทำ Hybrid Search ได้

### OCR Sidecar Engine Routing (port 8765)

```
POST /ocr-upload
  ├── engine="typhoon-np-dms-ocr"  →  Ollama → typhoon-np-dms-ocr:latest  ← PRIMARY
  └── engine="tesseract"           →  pytesseract (tha+eng)               ← FALLBACK

POST /embed       →  BGE-M3 (CPU RAM, ~2.3GB)  →  dense + sparse vectors
POST /rerank      →  BGE-Reranker-Large (CPU RAM, ~1.5GB)  →  reranked scores
POST /normalize   →  PyThaiNLP  →  normalized Thai text
```

**กฎ:**
- ไม่มี PyMuPDF fast-path (ยกเลิกแล้ว)
- BGE-M3 + Reranker รันบน CPU RAM ใน process เดียวกับ Sidecar (ไม่กิน VRAM ของ Ollama)
- Backend เลือก engine ผ่าน parameter `engine` ใน request body
- Tesseract ใช้เมื่อ Typhoon OCR ไม่พร้อม หรือ Admin เลือก fallback ใน Sandbox

---

## 4 Flows

### Flow 1 — OCR Sandbox (Admin ทดสอบและปรับ Prompt)

```
Admin อัปโหลด PDF (multipart)
  │
  ├─ [Step 1] POST /api/ai/admin/sandbox/ocr
  │    → BullMQ (ai-realtime) job type: "sandbox-ocr-only"
  │    → OcrService → Sidecar POST /ocr-upload (engine=typhoon-np-dms-ocr)
  │    → typhoon-np-dms-ocr:latest → raw OCR text
  │    → Redis: เก็บ ocrResult (text + engineUsed)
  │
  └─ [Step 2] POST /api/ai/admin/sandbox/ai-extract
       → BullMQ (ai-realtime) job type: "sandbox-ai-extract"
       → โหลด prompt template จาก ai_prompts (prompt_type=ocr_extraction)
       → OllamaService → typhoon2.5-np-dms:latest + ocrText + prompt
       → structured metadata (JSON)
       → Admin ดูผล → ปรับ prompt → บันทึกเวอร์ชันใหม่ลง ai_prompts
```

**ผลลัพธ์:** prompt template ที่ผ่านการทดสอบแล้ว ใช้ร่วมกับ Flow 2 และ Flow 3

---

### Flow 2 — n8n Migration Pipeline

```
n8n (Migration Phase only)
  │
  └─ POST /api/ai/jobs (type: "migrate-document")
       → BullMQ (ai-batch) job type: "migrate-document"
       │
       ├─ [OCR]     OcrService → Sidecar (engine=typhoon-np-dms-ocr) → raw text
       ├─ [Extract] โหลด prompt จาก ai_prompts → typhoon2.5-np-dms → metadata JSON
       └─ [Review]  INSERT migration_review_queue (status=PENDING)
                    → ✋ Human review ใน Admin UI
                    → approve → status=APPROVED → trigger Flow 2B

Flow 2B — RAG Prep (หลัง Human Approve → status เปลี่ยนจาก DRAFT)
       → BullMQ (ai-batch) job type: "rag-prepare"
       ├─ [Semantic Chunk] typhoon2.5-np-dms: วิเคราะห์ OCR text → ใส่ <chunk topic="..."> tag
       ├─ parse <chunk> tags → สร้าง chunk array
       ├─ POST /normalize → Sidecar → PyThaiNLP normalize แต่ละ chunk
       ├─ POST /embed → Sidecar → BGE-M3 → dense + sparse vectors
       ├─ [Delete old] QdrantService.deleteByDocId(projectPublicId, docPublicId) ← ถ้ามี revision เก่า
       └─ QdrantService.upsert(projectPublicId, chunks + payload) → Qdrant Hybrid Collection
```

**Qdrant Payload per chunk (11 fields):**
```json
{
  "doc_public_id": "019xxx-...",
  "project_public_id": "019yyy-...",
  "doc_number": "CORR-ABC-0042",
  "doc_type": "LETTER",
  "status_code": "SUBOWN",
  "revision_number": 1,
  "subject": "ขออนุมัติจัดซื้อ...",
  "document_date": "2026-06-05",
  "chunk_topic": "วัตถุประสงค์และหลักการ",
  "chunk_index": 0,
  "chunk_text": "เนื้อหา chunk ที่ normalized แล้ว..."
}
```

**กฎ:**
- n8n ห้าม call Ollama หรือ Sidecar โดยตรง — ต้องผ่าน `POST /api/ai/jobs` เท่านั้น (ADR-023A)
- RAG Prep trigger: หลัง Human approve → status เปลี่ยนจาก DRAFT (IN_REVIEW / SUBOWN ขึ้นไป)
- **Delete + Re-embed** เสมอเมื่อมี revision ใหม่ — ไม่เก็บ points จาก revision เก่า

---

### Flow 3 — Auto-fill (User Upload เอกสารใหม่)

```
User อัปโหลด PDF (two-phase upload)
  │
  ├─ POST /api/storage/upload → temp attachment (UUID)
  │
  └─ POST /api/ai/jobs (type: "auto-fill-document")
       → BullMQ (ai-realtime) job type: "auto-fill-document"
       │
       ├─ [OCR]     OcrService → Sidecar (engine=typhoon-np-dms-ocr) → raw text
       ├─ [Extract] โหลด prompt จาก ai_prompts → typhoon2.5-np-dms → metadata JSON
       └─ [Pre-fill] ส่งผลกลับ frontend → ✋ User review/edit form fields
                    → User submit → สร้างเอกสารสำเร็จ (status=ACTIVE)
                    → trigger Flow 3B (async)

Flow 3B — RAG Prep (trigger: status เปลี่ยนจาก DRAFT → IN_REVIEW / SUBOWN)
       → BullMQ (ai-batch) job type: "rag-prepare"
       ├─ [Semantic Chunk] typhoon2.5-np-dms: วิเคราะห์ OCR text → ใส่ <chunk topic="..."> tag
       ├─ parse <chunk> tags → สร้าง chunk array
       ├─ POST /normalize → Sidecar → PyThaiNLP normalize แต่ละ chunk
       ├─ POST /embed → Sidecar → BGE-M3 → dense + sparse vectors
       ├─ [Delete old] QdrantService.deleteByDocId(projectPublicId, docPublicId) ← ถ้ามี revision เก่า
       └─ QdrantService.upsert(projectPublicId, chunks + payload) → Qdrant Hybrid Collection
```

**กฎ:**
- RAG Prep trigger: **หลังผ่าน DRAFT** คือ status = IN_REVIEW (SUBOWN) ขึ้นไป — รวมเอกสารระหว่างดำเนินการ
- ไม่ block การสร้างเอกสาร — RAG Prep เป็น async background job เสมอ
- **Delete + Re-embed** เมื่อมี revision ใหม่ — status_code ใน payload อัปเดตตามสถานะล่าสุด

---

### Flow 4 — Chat Q&A (ผู้ใช้ถามคำถาม)

```
User ส่งคำถาม (ผ่าน Chat UI — ADR-026, scope = Project)
  │
  └─ POST /api/ai/chat (SSE streaming)
       → BullMQ (ai-realtime) job type: "rag-query"
       ├─ POST /embed → Sidecar → BGE-M3 → query dense + sparse vectors
       ├─ QdrantService.search(projectPublicId, queryVector, topK=15)
       │    filter: project_public_id = X  ← mandatory (ADR-023A)
       │    status: ALL embedded (รวม IN_REVIEW / SUBOWN)
       │    mode: Hybrid (dense + sparse)
       ├─ POST /rerank → Sidecar → BGE-Reranker-Large → top 3-5 chunks
       ├─ ประกอบ context: chunks + doc_number + document_date + status_code
       └─ typhoon2.5-np-dms:latest: ตอบพร้อมอ้างอิงเลขเอกสาร + วันที่
            → streaming response ไปยัง frontend (SSE)
```

**กฎ:**
- Scope = **Project** — ค้นหาข้ามเอกสารทุกชนิดในโปรเจกต์เดียวกัน
- Status = **All embedded** — รวมเอกสารระหว่างดำเนินการ (IN_REVIEW/SUBOWN) ด้วย
- `projectPublicId` เป็น mandatory filter ทุกครั้ง (compile-time enforcement — ADR-023A)

---

## BullMQ Job Type Summary

| Job Type | Queue | โมเดล / Service | Trigger |
|----------|-------|-----------------|---------|
| `sandbox-ocr-only` | ai-realtime | Sidecar: typhoon-np-dms-ocr | Admin Sandbox Step 1 |
| `sandbox-ai-extract` | ai-realtime | Ollama: typhoon2.5-np-dms | Admin Sandbox Step 2 |
| `migrate-document` | ai-batch | Sidecar OCR + Ollama: typhoon2.5-np-dms | n8n POST /api/ai/jobs |
| `auto-fill-document` | ai-realtime | Sidecar OCR + Ollama: typhoon2.5-np-dms | User upload |
| `rag-prepare` | ai-batch | Ollama: typhoon2.5-np-dms (chunk) + Sidecar: BGE-M3 (embed) | status OUT_OF_DRAFT (Flow 2B / 3B) |
| `rag-query` | ai-realtime | Sidecar: BGE-M3 (embed) + Reranker → Ollama: typhoon2.5-np-dms | User Chat Q&A |

**กฎ:**
- `ai-realtime`: งานที่ผู้ใช้รอผล (concurrency = 1)
- `ai-batch`: งาน background ที่ไม่ต้องรอ (concurrency = 1, ป้องกัน VRAM overflow)
- Sidecar = OCR Sidecar (port 8765) ซึ่งรวม BGE-M3 + Reranker ไว้ด้วย (CPU RAM)

---

## Model Switching (VRAM Management)

```
เมื่อ job ต้องการ typhoon-np-dms-ocr:
  1. unload typhoon2.5-np-dms (ถ้า VRAM ใกล้เต็ม)
  2. load typhoon-np-dms-ocr (keep_alive=0)
  3. process OCR
  4. typhoon-np-dms-ocr unload อัตโนมัติ (keep_alive=0)
  5. reload typhoon2.5-np-dms
```

**กฎ (จาก ADR-034):**
- BullMQ concurrency = 1 (ป้องกัน concurrent VRAM access)
- cold start OCR: 30-60s ยอมรับได้
- ห้ามโหลดทั้งสองโมเดลพร้อมกัน

---

## Qdrant Collection Schema

```python
# Hybrid Collection — Dense (BGE-M3 1024 dim) + Sparse (SPLADE keyword)
client.create_collection(
    collection_name="dms_documents",
    vectors_config={
        "bge_dense": VectorParams(size=1024, distance=Distance.COSINE)
    },
    sparse_vectors_config={
        "bge_sparse": SparseVectorParams()
    }
)
```

**Payload Index** (สำหรับ filter performance):
- `project_public_id` — mandatory filter ทุก query
- `doc_public_id` — ใช้ deleteByDocId เมื่อ re-embed
- `status_code` — filter เมื่อต้องการ approved only
- `doc_type` — filter by document type

---

## Impact on Related ADRs

| ADR | Section | Impact |
|-----|---------|--------|
| **ADR-034** | Section 2 (Implementation Details — Switching Logic) | Superseded by ADR-035 — ใช้ job type mapping ที่นี่แทน |
| **ADR-023A** | BullMQ 2-queue + nomic-embed-text | `nomic-embed-text` แทนที่ด้วย BGE-M3 (ใน Sidecar); queue structure เดิมยังใช้ได้ |
| **ADR-030** | Prompt Templates | ยังใช้ได้ — prompt ดึงจาก `ai_prompts` ทุก flow |
| **ADR-026** | Chat UI | ยังใช้ได้ — Flow 4 ใช้ SSE streaming + Project scope ตามที่ออกแบบ |

---

## Implementation Status

| Flow | สถานะ |
|------|-------|
| Flow 1 (Sandbox) | ✅ มีแล้ว — กำลังปรับปรุง OCR engine ให้ตรง ADR-035 |
| Flow 2 (n8n) | 🔧 OCR + Extract กำลังปรับปรุง — RAG Prep (Flow 2B) ✅ พร้อมใช้ |
| Flow 3 (Auto-fill) | ❌ ยังไม่มี (OCR + Extract + RAG Prep) |
| Flow 4 (Chat Q&A) | ✅ สมบูรณ์ตามสถาปัตยกรรมใหม่ (Dense + Sparse Hybrid Search และ Reranking) |

### Legacy Compatibility Note

- Dashboard RAG page หลักถูกย้ายไปใช้ `/ai/rag/query` + `/ai/rag/jobs/:requestPublicId` แล้ว
- Legacy frontend hook `frontend/hooks/use-rag.ts` และ `frontend/components/rag/*` ถูกถอดออกแล้ว หลังย้าย dashboard ไป flow ใหม่
- Consumer audit ใน repo ปัจจุบันไม่พบ caller ของ `/rag/status`, `/rag/ingest`, `/rag/vectors`, `/rag/admin/init-collection`
- Legacy backend controller/module (`backend/src/modules/rag/rag.controller.ts`, `rag.module.ts`) ถูกถอดออกจาก runtime แล้ว เพื่อให้สอดคล้องกับ feature 234
- หากยังมี external callers ของ `/rag/*` อยู่นอก repo ต้อง migrate ไป `/ai/rag/*` ก่อน release ถัดไป

---

**สำหรับ Implementation:** ดูไฟล์ใน `specs/100-Infrastructures/135-ai-pipeline-flow/` (สร้างเมื่อเริ่ม implement)
