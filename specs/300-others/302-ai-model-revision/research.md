# Research: AI Model Revision (ADR-023A)

**Feature**: `302-ai-model-revision`
**Date**: 2026-05-15
**Status**: Complete — all decisions validated via Grilling Session

---

## Decision 1: Model Stack Reduction

- **Decision**: ใช้ 2-model stack: `gemma4:e4b Q8_0` + `nomic-embed-text` แทน 3-model stack เดิม
- **Rationale**: VRAM budget RTX 2060 Super 8GB — 3-model stack (gemma4:9b + Typhoon + nomic-embed-text) ใช้ ~7.8GB ไม่มี headroom; 2-model stack ใช้ ~4.5GB peak มี headroom ~3.5GB
- **Alternatives considered**:
  - gemma4:9b + nomic-embed-text (ไม่มี Typhoon): ยังเกิน budget ~6.8GB
  - gemma4:e4b Q4_K_M (quantize ต่ำกว่า): ประหยัด VRAM มากกว่าแต่คุณภาพต่ำกว่า Q8_0
  - ย้ายไปใช้ Cloud AI: ขัดกับ ADR-023 (INTERNAL data — ห้าม Cloud)
- **VRAM Detail**: gemma4:e4b Q8_0 = ~4.0GB weights + ~0.2GB KV Cache (จำกัดโดย 3-page input limit) + nomic-embed-text ~0.3GB = **~4.5GB peak**

---

## Decision 2: BullMQ 2-Queue Architecture

- **Decision**: แยกเป็น 2 Queues: `ai-realtime` (concurrency=1) + `ai-batch` (concurrency=1) พร้อม auto-pause mechanism
- **Rationale**: Single queue ทำให้ RAG Q&A (interactive, p95 < 10s) ถูก block โดย OCR/Embed batch jobs (ไม่มี SLA); 2-queue ให้ priority separation โดยไม่เพิ่ม Worker ที่ทำให้ VRAM overflow
- **Alternatives considered**:
  - Single queue + priority field: priority ใน BullMQ ไม่ป้องกัน long-running job ที่กำลังรันอยู่ block queue ถัดไป
  - 2 Queues + 2 Workers พร้อมกัน: VRAM overflow เมื่อทั้งคู่ใช้ gemma4:e4b พร้อมกัน
- **Implementation**: BullMQ `active` event บน `ai-realtime` → pause `ai-batch`; `completed`/`failed` → resume `ai-batch`

---

## Decision 3: PDF Input Strategy

- **Decision**: 3-page limit สำหรับ Classification/Tagging; Full-document chunking สำหรับ RAG Embedding
- **Rationale**: Engineering docs มีข้อมูล metadata หลักในหน้าแรก 1-3 (Title Block, Drawing No., Revision); Full-doc embed ไม่กระทบ VRAM เพราะ nomic-embed-text ประมวลผล chunk ละ 512 tokens (stateless)
- **Alternatives considered**:
  - Full-doc ทั้ง Classification และ Embed: กระทบ VRAM และ SLA ของ Classification
  - 3-page ทั้ง Classification และ Embed: RAG ไม่เจอเนื้อหาในหน้าท้าย — useless สำหรับเอกสาร 50+ หน้า

---

## Decision 4: OCR Auto-Detection

- **Decision**: ตรวจสอบ `extracted_chars > OCR_CHAR_THRESHOLD (100)` ต่อหน้าด้วย PyMuPDF ก่อน route
- **Rationale**: ทั้ง Legacy และ New Upload อาจมีทั้ง Scanned และ Digital — auto-detect ดีกว่า user-select เพราะ user ไม่รู้ว่า PDF ตัวเองเป็นแบบไหน; threshold 100 chars ป้องกัน watermark-only PDF ถูก classify ผิด
- **Alternatives considered**:
  - User เลือก pipeline: UX แย่ + error prone
  - ใช้ OCR ทุกไฟล์เสมอ: ช้าเกินไปสำหรับ Digital PDF

---

## Decision 5: n8n ↔ BullMQ Boundary

- **Decision**: n8n call `POST /api/ai/jobs` (DMS API) → BullMQ queue; ไม่เรียก Ollama โดยตรง
- **Rationale**: ถ้า n8n bypass BullMQ → ai_audit_logs ไม่ถูกบันทึก + ไม่มี RBAC check + ไม่มี ADR-007 error handling; DMS API เป็น single gateway ที่ enforce ทุก cross-cutting concern
- **Alternatives considered**:
  - n8n HTTP Request node → Ollama API: bypass ทั้ง audit, RBAC, error handling
  - n8n Execute Command → Python script → Ollama: อันตราย, ไม่มี audit trail

---

## Decision 6: QdrantService Multi-Tenancy Enforcement

- **Decision**: `QdrantService.search(projectPublicId: string, ...)` — required param, ห้าม expose `rawSearch()`
- **Rationale**: ถ้า developer ลืม filter → ข้อมูลข้ามโครงการรั่วไหล (INTERNAL data sensitivity); compile-time enforcement ดีกว่า runtime guard
- **Alternatives considered**:
  - Middleware filter: ยังต้องใช้ Service method — ป้องกันได้น้อยกว่า
  - Optional parameter with default: ยังมีโอกาส pass undefined ได้

---

## Decision 7: Threshold Recalibration Policy

- **Decision**: ใช้ค่าเริ่มต้น 0.85/0.60 สำหรับ Migration Phase แรก แล้ว recalibrate หลัง 100-500 ฉบับแรก
- **Rationale**: ค่าเดิมถูกกำหนดในยุค gemma4:9b — distribution อาจเปลี่ยนไปกับ gemma4:e4b; recalibrate จาก real data ดีกว่า hardcode ค่าใหม่โดยไม่มีข้อมูล
- **Trigger**: REJECTED rate > 30% หรือ Admin override rate > 40% → ปรับลด threshold

---

## Unvalidated Assumptions (Risk Register)

| Assumption | Risk | Mitigation |
|-----------|------|-----------|
| gemma4:e4b Q8_0 รองรับภาษาไทยได้ดีเพียงพอ | HIGH — ไม่มีหลักฐานเชิงคุณภาพ | ทดสอบ 50-100 ฉบับก่อน Go-live; เตรียม Prompt Engineering ชดเชย |
| 3-page limit เพียงพอสำหรับ metadata extraction | MEDIUM — บางเอกสารอาจมี title block หน้า 4+ | ตรวจสอบตัวอย่างเอกสาร 20 ฉบับก่อน implementation |
| RTX 2060 Super VRAM ใช้ได้ 8GB เต็ม | LOW — GPU อาจมี overhead จาก OS และ driver | monitor จริงด้วย `nvidia-smi` ระหว่าง UAT |
