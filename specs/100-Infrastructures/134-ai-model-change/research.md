// File: specs/100-Infrastructures/134-ai-model-change/research.md
// Change Log:
// - 2026-06-03: Phase 0 research for Thai-Optimized AI Model Stack

# Research: Thai-Optimized AI Model Stack

**Status**: Complete — all decisions resolved from ADR-034

---

## Decision 1: Model Unloading via Ollama API

**Decision**: ใช้ `POST /api/generate` พร้อม `keep_alive: 0` และ `prompt: ""` เพื่อ unload model จาก VRAM
**Rationale**: Ollama ไม่มี dedicated unload endpoint; การส่ง `keep_alive: 0` จะทำให้ model unload ทันทีหลัง request complete; ส่ง empty prompt เพื่อเรียก endpoint โดยไม่ generate output
**Alternatives considered**:
- Restart Ollama service — disruptive; ใช้เวลานาน; ทำลาย in-flight jobs
- `/api/delete` — ลบ model ออกจาก registry ไม่ใช่แค่ unload จาก VRAM

---

## Decision 2: Model Loading via Ollama API

**Decision**: ใช้ `POST /api/generate` พร้อม `keep_alive: -1` สำหรับ main model; `keep_alive: 0` สำหรับ OCR model
**Rationale**: การส่ง request ไปยัง model ที่ยังไม่ได้ load จะ trigger Ollama auto-load; `keep_alive: -1` = infinite standby (ตาม ADR-034 "Stand by ตลอด"); `keep_alive: 0` = auto-unload หลัง job
**Alternatives considered**:
- `POST /api/chat` — ใช้ได้เช่นกัน แต่ `/api/generate` มี API surface เล็กกว่า เหมาะสำหรับ keepalive ping

---

## Decision 3: OCR Job Type List

**Decision**: OCR job types = `['ocr-extract', 'sandbox-ocr-only']`
**Rationale**: ทั้งสอง job types ต้องการ OCR model; `ocr-extract` = production; `sandbox-ocr-only` = admin sandbox; types อื่นทั้งหมดใช้ main model
**Alternatives considered**:
- Config-driven job types — over-engineering; ADR-034 กำหนดไว้แล้ว
- DB-driven routing — เพิ่ม complexity โดยไม่จำเป็น

---

## Decision 4: DEFAULT_MODEL Strategy — Hardcode

**Decision**: Hardcode `DEFAULT_MODEL = 'typhoon2.5-np-dms:latest'` ใน `AiSettingsService`
**Rationale**: ADR-034 ระบุชัดเจน "ไม่ต้อง update ai_settings table — ใช้ hardcode value เพื่อความเร็วในการ deploy"; การ hardcode ป้องกัน misconfiguration จาก DB
**Alternatives considered**:
- อ่านจาก `ai_settings` DB table — ถูก reject ใน ADR-034 เพื่อความง่ายใน deployment
- อ่านจาก ENV variable — อาจ conflict กับ ADR-027 model management; hardcode ชัดกว่า

---

## Decision 5: ai_available_models Table Update

**Decision**: สร้าง SQL delta `2026-06-03-update-ai-available-models-typhoon.sql` อัปเดต seed
**Rationale**: ADR-027 Admin Console อ่านจาก `ai_available_models` table; ถ้าไม่อัปเดตจะแสดงชื่อ model เก่า ทำให้ admin เห็น inconsistency
**Alternatives considered**:
- ไม่อัปเดต table — admin console แสดงข้อมูลเก่า; เสี่ยง confusion

---

## Decision 6: Error Handling for Model Switching Failure

**Decision**: Throw `Error` พร้อม descriptive message ที่ระบุ model name; NestJS Logger บันทึก context; ไม่ retry ภายใน switching logic (ปล่อยให้ BullMQ retry ตาม job policy)
**Rationale**: Model load failure ควร fail fast; BullMQ ที่มี retry config จะ re-attempt job ทั้งหมด รวมถึง switching sequence ด้วย; การ retry ภายใน switching เสี่ยง VRAM state inconsistency
**Alternatives considered**:
- Retry unload/load ภายใน service — อาจทำให้ VRAM state confused ถ้า partial load

---

## Unresolved Items

ไม่มี — decisions ทั้งหมดถูก resolve แล้ว
