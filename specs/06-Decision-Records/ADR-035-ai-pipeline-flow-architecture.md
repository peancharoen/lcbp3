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
| `typhoon2.5-np-dms:latest` | (1) Extract metadata, (2) RAG chunk prep, (3) Q&A | Standby ตลอด | BullMQ → OllamaService |
| `nomic-embed-text` | Embedding vectors → Qdrant | — | BullMQ → OllamaService |

### OCR Sidecar Engine Routing

```
POST /ocr-upload (port 8765)
  ├── engine="typhoon-np-dms-ocr"  →  Ollama → typhoon-np-dms-ocr:latest  ← PRIMARY
  └── engine="tesseract"           →  pytesseract (tha+eng)               ← FALLBACK
```

**กฎ:**
- ไม่มี PyMuPDF fast-path (ยกเลิกแล้ว)
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

Flow 2B — RAG Prep (หลัง Human Approve)
       → BullMQ (ai-batch) job type: "rag-prepare"
       ├─ typhoon2.5-np-dms: แบ่ง chunk (512 tokens / 64 overlap)
       ├─ POST /normalize → Sidecar → PyThaiNLP normalize
       ├─ nomic-embed-text: embed แต่ละ chunk
       └─ QdrantService.upsert(projectPublicId, chunks) → Qdrant
```

**กฎ:**
- n8n ห้าม call Ollama หรือ Sidecar โดยตรง — ต้องผ่าน `POST /api/ai/jobs` เท่านั้น (ADR-023A)
- RAG Prep เกิดขึ้นหลัง **Human approve** เท่านั้น — ไม่ auto embed ก่อนยืนยัน

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

Flow 3B — RAG Prep (หลังเอกสารถูกสร้างสำเร็จ)
       → BullMQ (ai-batch) job type: "rag-prepare"
       ├─ typhoon2.5-np-dms: แบ่ง chunk
       ├─ POST /normalize → Sidecar → PyThaiNLP normalize
       ├─ nomic-embed-text: embed
       └─ QdrantService.upsert(projectPublicId, chunks) → Qdrant
```

**กฎ:**
- RAG Prep เกิดหลังเอกสารถูกสร้างสำเร็จ (document status = ACTIVE) เท่านั้น
- ไม่ block การสร้างเอกสาร — RAG Prep เป็น async background job

---

### Flow 4 — Chat Q&A (ผู้ใช้ถามคำถาม)

```
User ส่งคำถาม (ผ่าน Chat UI — ADR-026)
  │
  └─ POST /api/ai/chat (หรือ SSE streaming)
       → BullMQ (ai-realtime) job type: "rag-query"
       ├─ nomic-embed-text: embed คำถาม
       ├─ QdrantService.search(projectPublicId, queryVector, topK=5)
       ├─ ดึง document chunks ที่เกี่ยวข้อง + metadata (เลขเอกสาร, วันที่)
       └─ typhoon2.5-np-dms:latest: ตอบพร้อมอ้างอิงเอกสาร
            → streaming response ไปยัง frontend (SSE)
```

---

## BullMQ Job Type Summary

| Job Type | Queue | โมเดล | Trigger |
|----------|-------|-------|---------|
| `sandbox-ocr-only` | ai-realtime | typhoon-np-dms-ocr (Sidecar) | Admin Sandbox Step 1 |
| `sandbox-ai-extract` | ai-realtime | typhoon2.5-np-dms | Admin Sandbox Step 2 |
| `migrate-document` | ai-batch | typhoon-np-dms-ocr + typhoon2.5-np-dms | n8n POST /api/ai/jobs |
| `auto-fill-document` | ai-realtime | typhoon-np-dms-ocr + typhoon2.5-np-dms | User upload |
| `rag-prepare` | ai-batch | typhoon2.5-np-dms + nomic-embed-text | Flow 2B (approve) / Flow 3B (doc created) |
| `rag-query` | ai-realtime | nomic-embed-text + typhoon2.5-np-dms | User Chat Q&A |

**กฎ:**
- `ai-realtime`: งานที่ผู้ใช้รอผล (concurrency = 1)
- `ai-batch`: งาน background ที่ไม่ต้องรอ (concurrency = 1, ป้องกัน VRAM overflow)

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

## Impact on Related ADRs

| ADR | Section | Impact |
|-----|---------|--------|
| **ADR-034** | Section 2 (Implementation Details — Switching Logic) | Superseded by ADR-035 — ใช้ job type mapping ที่นี่แทน |
| **ADR-023A** | BullMQ 2-queue | ยังใช้ได้ — เพิ่ม job types ใหม่ใน queue เดิม |
| **ADR-030** | Prompt Templates | ยังใช้ได้ — prompt ดึงจาก `ai_prompts` ทุก flow |
| **ADR-026** | Chat UI | ยังใช้ได้ — Flow 4 ใช้ SSE streaming ตามที่ออกแบบ |

---

## Implementation Status

| Flow | สถานะ |
|------|-------|
| Flow 1 (Sandbox) | ✅ มีแล้ว — กำลังปรับปรุง OCR engine ให้ตรง ADR-035 |
| Flow 2 (n8n) | 🔧 OCR + Extract กำลังปรับปรุง — RAG Prep (Flow 2B) ยังไม่มี |
| Flow 3 (Auto-fill) | ❌ ยังไม่มี (OCR + Extract + RAG Prep) |
| Flow 4 (Chat Q&A) | ⚠️ บางส่วน — ต้องปรับปรุงตาม flow นี้ |

---

**สำหรับ Implementation:** ดูไฟล์ใน `specs/200-fullstacks/235-ai-pipeline-flow/` (สร้างเมื่อเริ่ม implement)
