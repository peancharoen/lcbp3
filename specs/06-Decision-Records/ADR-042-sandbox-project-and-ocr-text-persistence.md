# ADR-042: Sandbox Project (DB-Committing Full-Pipeline Test) + OCR Text Persistence

**Status:** Proposed
**Date:** 2026-07-27
**Decision Makers:** Development Team (pending review)
**Supersedes:** — (extends, does not replace, ADR-036 Production Pipeline Sandbox)
**Amends:** `CONTEXT.md` → "Production Pipeline Sandbox" (ADR-036), AI Pipeline Step A (OCR extraction), Sandbox Flow (Admin Console)
**Related Documents:**
- [ADR-036: Unified OCR Architecture — Production Pipeline Sandbox](./ADR-036-unified-ocr-architecture.md)
- [ADR-023A: Unified AI Architecture](./ADR-023A-unified-ai-architecture.md)
- [ADR-016: Security & Authentication (Two-Phase Upload)](./ADR-016-security-authentication.md)
- [ADR-008: Email/Notification Strategy (BullMQ)](./ADR-008-email-notification-strategy.md)
- [CONTEXT.md](../../CONTEXT.md)

> **Grilling resolution (2026-07-27):** เกิดจากการ grill แผน "บันทึก OCR text ก่อนทำ embedding" + "ทำให้ Sandbox ทดสอบ Production Flow ได้ทุก step" คู่กับ `docs/AI-step.md`. พบข้อขัดแย้งกับนิยาม **Production Pipeline Sandbox** (ADR-036) ที่ระบุว่า sandbox "ไม่ commit ลง DB" — resolved ว่าเป็นคนละแนวคิดกัน: **Production Pipeline Sandbox** (เดิม, คงอยู่ 3 step: OCR-only / AI-extract / RAG-prep) ยังคง**ไม่ commit DB**; ส่วน **Sandbox Project** (ใหม่, ADR นี้) คือ project flag แยกที่ยอมให้ admin เดินผ่าน code path การผลิตจริงทั้งหมด (upload → create → submit → AI Pipeline) แบบ commit DB จริง เพื่อทดสอบ parity 100% โดยจำกัด blast radius ด้วย `project_id` และมี cleanup endpoint ลบทิ้งได้

---

## Context and Problem Statement

`docs/AI-step.md` สรุป AI Document Processing Flow ไว้ 2 เส้นทาง: **Production Flow** (สร้าง/submit correspondence จริง) และ **Sandbox Flow** (ทดสอบ AI แยกส่วนแบบไม่บันทึกลง DB). ระหว่างการ grill แผนปรับปรุง 2 เรื่องนี้พบปัญหา:

1. **OCR text ที่สกัดได้ไม่เคยถูกบันทึกถาวร** — `processRagPrepare()` เก็บผล OCR ไว้ใน local variable เท่านั้น ถ้า Step B (semantic chunking + embedding) fail ทีหลัง ระบบต้องรัน OCR ซ้ำทั้งหมดเมื่อ retry เพราะไม่มีที่เก็บกลาง
2. **Sandbox Flow ทดสอบได้แค่ AI Pipeline บางส่วน** — 3 step ที่มีอยู่ (OCR-only, AI-extract, RAG-prep) ครอบคลุมเฉพาะ "AI Pipeline" ไม่ครอบคลุม "Production Flow" (two-phase upload → commit → workflow submit → trigger) เพราะ sandbox ถูกออกแบบให้ไม่แตะ DB จริงตาม **Production Pipeline Sandbox** (ADR-036)
3. การจะทำให้ทดสอบ Production Flow ได้ "ทุก step" จำเป็นต้อง exercise โค้ด `CorrespondenceService.create()` / `CorrespondenceWorkflowService.submitWorkflow()` ตัวจริง ซึ่ง**ต้อง commit ลง DB** — ขัดกับนิยามเดิมของ ADR-036 โดยตรง

---

## Decision Drivers

- **Data durability**: OCR เป็นงานหนัก (VRAM/เวลา) ไม่ควรสูญเมื่อ retry
- **Test fidelity**: การ mock Production Flow เสี่ยง drift จากโค้ดจริงมากกว่าการรันโค้ดจริงในพื้นที่แยก
- **Blast radius control**: ห้ามให้ sandbox testing ปนกับ production data ของโครงการจริง
- **Backward compatibility**: ห้ามกระทบ Production Pipeline Sandbox (ADR-036) ที่ admin ใช้ทดสอบ parameter tuning อยู่แล้ว

---

## Decision Outcome

### 1. OCR Text Persistence — แยก `rag-prepare` เป็น 2 jobs

```
rag-prepare job (เปลี่ยนบทบาทเป็น "OCR extract + persist"):
  1. detectAndExtract() → ocrText
  2. UPDATE attachments SET ocr_text = ? WHERE public_id = ?   -- เขียนก่อนเสมอ
  3. enqueue embed-document job (extractedText = ocrText, ข้าม OCR ซ้ำ)
     jobId = embed-document:{documentPublicId}:{revisionNumber}

embed-document job (เดิม, ไม่เปลี่ยน logic):
  - รับ extractedText → ข้าม detectAndExtract()
  - semantic chunking + embed + Qdrant upsert
  - เขียน ai_audit_logs SUCCESS (เหมือนเดิม — ที่จบ pipeline จริง)
```

- คอลัมน์ใหม่: `attachments.ocr_text LONGTEXT NULL` — scope เฉพาะ attachment ที่ `triggerRagPrepare()` เลือกอยู่แล้ว (ไม่ fix gap "1 attachment ต่อ revision" ซึ่งเป็น scope แยก)
- Payload ใหม่: `RagPrepareJobPayload.attachmentPublicId` (ใช้เป็น key แทน `file_path` ที่ไม่ unique) — ตาม ADR-019

### 2. Sandbox Project — DB-committing Full Pipeline Test

**ไม่แก้ Production Pipeline Sandbox เดิม (ADR-036)** — เพิ่มแนวคิดใหม่คู่ขนาน:

| แนวคิด | Commit DB? | ทดสอบอะไร | Endpoint |
|---|---|---|---|
| **Production Pipeline Sandbox** (ADR-036, คงเดิม) | ❌ ไม่ | OCR + LLM extraction เท่านั้น (ไม่มี correspondence) | `/ai/admin/sandbox/ocr`, `/ai-extract`, `/rag-prep` |
| **Sandbox Project** (ใหม่, ADR นี้) | ✅ ใช่ (scoped) | Production Flow ทั้ง 3 phase + AI Pipeline ทั้ง 2 step แบบ end-to-end จริง | endpoint การผลิตจริง (`/files/upload`, `/correspondences`, `/correspondences/:uuid/submit`) โดยส่ง `projectPublicId` ของ Sandbox Project |

- `projects.is_sandbox BOOLEAN DEFAULT 0` — seed 1 แถวไว้เป็น sandbox project ตายตัว
- Endpoint list โครงการปกติ (`GET /projects` และทุกจุดที่ populate project dropdown) กรอง `WHERE is_sandbox = 0` เสมอ — ผู้ใช้ทั่วไปมองไม่เห็น
- Cleanup: `POST /ai/admin/sandbox/clear-data` (CASL `system.manage_all`) — hard-delete cascading (`correspondences` → `correspondence_revisions` → `correspondence_revision_attachments`/`attachments` → `workflow_instances`/`workflow_histories`) **scoped `WHERE project_id = sandboxProjectId` เท่านั้น** + enqueue `enqueueVectorDeletion()` ต่อเอกสารเพื่อลบ Qdrant vectors

### 3. CONTEXT.md Updates

- เพิ่ม term **"Sandbox Project"** ในหมวด AI — ชี้แจงว่าต่างจาก Production Pipeline Sandbox อย่างไร
- คง **"Production Pipeline Sandbox"** เดิมไว้ทุกคำตามที่ resolve ใน ADR-036 — ไม่แก้ไข/ไม่ supersede

---

## Considered Options (สำหรับ Sandbox Project)

1. **Mock/simulate Production Flow โดยไม่ commit DB จริง** — คง invariant ของ ADR-036 ไว้ทั้งหมด แต่ต้องเขียน mock logic คู่ขนานกับของจริง เสี่ยง drift สูง เมื่อ production code เปลี่ยนแต่ mock ไม่ตาม — **ปฏิเสธ**
2. **Sandbox Project ที่ commit DB จริงแบบ scoped** (เลือกใช้) — fidelity 100% เพราะรันโค้ด production เป๊ะ, ความเสี่ยงคุมได้ด้วย `project_id` filter + cleanup endpoint

---

## Consequences

**ดี:**
- OCR text ไม่สูญหายเมื่อ retry embedding — ลดภาระ GPU/เวลาซ้ำซ้อน
- ทดสอบ Production Flow ได้ parity 100% กับของจริง ไม่ต้อง maintain mock แยก

**ต้องระวัง:**
- Sandbox Project data ต้องถูกลบเป็นระยะ (ไม่มี auto-TTL ในเวอร์ชันนี้) — ต้องอาศัย admin กด "Clear Sandbox Data" เอง
- `attachments.ocr_text` เพิ่มขนาด storage ต่อไฟล์ (LONGTEXT) — ยอมรับได้เพราะ 1 แถวต่อ 1 attachment ที่ถูกประมวลผลจริงเท่านั้น
- แยก `rag-prepare`/`embed-document` เป็น 2 jobs ทำให้ retry semantics เปลี่ยน (Step A สำเร็จแล้วไม่ retry ซ้ำ แม้ Step B fail) — ต้อง monitor `ai_audit_logs` เพื่อ track ว่า pipeline จบสมบูรณ์หรือค้างที่ Step B
