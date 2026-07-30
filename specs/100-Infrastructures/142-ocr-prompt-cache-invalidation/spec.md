// File: specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/spec.md
// Change Log:
// - 2026-07-22: Initial specification for OCR Prompt Cache Invalidation

# Feature Specification: OCR Prompt Cache Invalidation

**Feature Branch**: `142-ocr-prompt-cache-invalidation`
**Created**: 2026-07-22
**Status**: Draft
**Category**: 100-Infrastructures
**Input**: User description: "เมื่อ Ollama model ค้างใน VRAM (keep_alive > 0) การเปลี่ยน system prompt ใน payload ไม่มีผล เพราะ KV cache ยึด context เดิม ต้อง unload/reload model ถึงจะใช้ system prompt ใหม่ได้"

## Clarifications

### Session 2026-07-23

- Q: ถ้ามี concurrent OCR requests พร้อมกันด้วย prompt ต่างกัน จะจัดการอย่างไร? → A: บังคับ sequential — ใช้ asyncio.Lock ที่ sidecar เพื่อให้ OCR request ทีละตัว (รอ unload + reload เสร็จก่อนรับ request ถัดไป)
- Q: ใช้วิธีใดในการ unload model จาก Ollama? → A: ส่ง empty request พร้อม keep_alive=0 ไป /v1/chat/completions เพื่อบังคับ unload (วิธีที่ผู้ใช้ทดลองและยืนยันได้ผล)
- Q: prompt hash ควรเก็บและเปรียบเทียบอย่างไรเมื่อมีหลาย worker หรือหลาย engine type? → A: เก็บใน Redis เพื่อรองรับ multi-worker/multi-process ในอนาคต

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin เปลี่ยน OCR Prompt แล้วส่ง OCR ใหม่ (Priority: P1)

Admin ใช้ Admin Console เปลี่ยน active OCR prompt (prompt_type='ocr_extraction') ในระบบ จากนั้นมีการส่งไฟล์ PDF เข้า OCR pipeline เพื่อสกัดข้อมูล ระบบต้องใช้ prompt ใหม่ที่ Admin ตั้งไว้ ไม่ใช่ prompt เดิมที่ค้างอยู่ใน Ollama KV cache

**Why this priority**: หาก prompt ใหม่ไม่มีผล การแก้ไข prompt ผ่าน Admin Console ก็ไร้ค่า ส่งผลต่อคุณภาพการสกัดข้อมูลเอกสารทั้งระบบ

**Independent Test**: เปลี่ยน prompt ใน Admin Console → ส่ง PDF เข้า OCR → ตรวจสอบผลลัพธ์ว่าใช้ prompt ใหม่

**Acceptance Scenarios**:

1. **Given** Ollama model `np-dms-ocr:latest` ค้างอยู่ใน VRAM (keep_alive > 0) จาก request ก่อนหน้าที่ใช้ prompt A, **When** Admin เปลี่ยน active prompt เป็น B แล้วส่ง PDF เข้า OCR, **Then** ผลลัพธ์ต้องเป็นไปตาม prompt B (ไม่ใช่ A)
2. **Given** Ollama model ไม่ได้ค้างใน VRAM (keep_alive = 0), **When** ส่ง PDF เข้า OCR พร้อม prompt B, **Then** ผลลัพธ์ต้องเป็นไปตาม prompt B โดยไม่ต้อง unload อะไรเพิ่ม
3. **Given** ส่ง OCR หลายไฟล์ติดต่อกันด้วย prompt เดียวกัน, **When** ไฟล์ที่ 2 ถูกส่งเข้า, **Then** ไม่ต้อง unload/reload model (ใช้ KV cache เดิมได้ เพราะ prompt ไม่เปลี่ยน)

---

### User Story 2 - ระบบตรวจจับการเปลี่ยน prompt อัตโนมัติ (Priority: P2)

ระบบ OCR sidecar ตรวจจับได้เองว่า system prompt ที่ส่งมาใน payload เปลี่ยนจากครั้งก่อนหน้าหรือไม่ หากเปลี่ยน → บังคับ unload model ก่อนประมวลผล request ใหม่ หากไม่เปลี่ยน → ใช้ model ที่ค้างใน VRAM ต่อไปได้

**Why this priority**: ทำให้ระบบใช้ VRAM ได้อย่างมีประสิทธิภาพ — unload เฉพาะเมื่อจำเป็น ไม่ใช่ unload ทุกครั้ง

**Independent Test**: ส่ง OCR 2 ครั้งด้วย prompt เดียวกัน → ตรวจสอบว่า request ที่ 2 ไม่มี cold start → เปลี่ยน prompt → ส่ง OCR อีกครั้ง → ตรวจสอบว่ามี unload + reload

**Acceptance Scenarios**:

1. **Given** model ค้างใน VRAM พร้อม prompt A, **When** ส่ง OCR ด้วย prompt A อีกครั้ง, **Then** ไม่มีการ unload model (ใช้ cache ต่อไป)
2. **Given** model ค้างใน VRAM พร้อม prompt A, **When** ส่ง OCR ด้วย prompt B, **Then** ระบบ unload model และ reload พร้อม prompt B ก่อนประมวลผล
3. **Given** sidecar รีสตาร์ทใหม่ (ไม่มี prompt history), **When** ส่ง OCR ด้วย prompt A, **Then** ประมวลผลปกติโดยไม่ต้อง unload อะไรก่อน

---

### User Story 3 - รองรับการย้าย Server ใหม่ RTX 5060 Ti 16GB (Priority: P3)

หลังย้ายไป New Server (192.168.10.11) ตาม MIGRATION-PLAN.md ที่มี RTX 5060 Ti 16GB VRAM (เพิ่มจาก 8GB) ระบบสามารถเก็บ model ค้างใน VRAM ได้นานขึ้น (keep_alive > 0) โดยไม่ชนกับ model อื่น ทำให้ปัญหา prompt cache มีผลกระทบมากขึ้น ต้องแก้ให้ถูกต้องก่อนย้าย

**Why this priority**: เป็นการเตรียมพร้อมสำหรับ migration — หากไม่แก้ ปัญหาจะปรากฏชัดเจนเมื่อ VRAM มากพอที่ keep_alive > 0 ทำงานได้จริง

**Independent Test**: จำลอง keep_alive = 120 บน New Server → เปลี่ยน prompt → ส่ง OCR → ตรวจสอบผลลัพธ์

**Acceptance Scenarios**:

1. **Given** New Server มี VRAM 16GB และ keep_alive = 120, **When** เปลี่ยน prompt แล้วส่ง OCR, **Then** ระบบ unload และ reload อัตโนมัติเพื่อใช้ prompt ใหม่
2. **Given** New Server มี VRAM 16GB, **When** ส่ง OCR หลายไฟล์ด้วย prompt เดียวกัน, **Then** ไฟล์ที่ 2 เป็น hot path (ไม่ cold start) เพราะ model ยังค้างใน VRAM

---

### Edge Cases

- ส่ง OCR โดยไม่มี systemPrompt (None) หลังจากส่งด้วย prompt A มาก่อน → ต้อง unload เพราะ prompt เปลี่ยน (จาก A เป็น None)
- ส่ง OCR โดยไม่มี systemPrompt (None) สองครั้งติดต่อกัน → ไม่ต้อง unload (prompt ไม่เปลี่ยน)
- sidecar รีสตาร์ทระหว่างที่ model ค้างใน VRAM → prompt history หาย → ไม่ต้อง unload ใน request แรก
- ส่ง OCR หลายหน้าในไฟล์เดียว (multi-page PDF) → แต่ละหน้าใช้ prompt เดียวกัน → ไม่ต้อง unload ระหว่างหน้า
- Ollama ล่มหรือรีสตาร์ทระหว่างประมวลผล → sidecar ต้อง retry โดยไม่ยึด prompt history เดิม
- มี OCR requests พร้อมกัน 2 งานด้วย prompt ต่างกัน → asyncio.Lock บังคับ sequential: request แรก unload+reload พร้อม prompt A → request ที่ 2 รอจนเสร็จ → ตรวจจับ prompt เปลี่ยน → unload+reload พร้อม prompt B

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: OCR sidecar ต้องเก็บ hash ของ systemPrompt ล่าสุดที่ส่งไป Ollama ใน Redis เพื่อเปรียบเทียบใน request ถัดไป รองรับ multi-worker/multi-process
- **FR-002**: เมื่อ systemPrompt เปลี่ยน (hash ต่างกัน) sidecar ต้องส่ง unload request ไป Ollama (keep_alive=0 บน empty request) ก่อนประมวลผล request ใหม่
- **FR-003**: เมื่อ systemPrompt ไม่เปลี่ยน (hash เหมือนเดิม หรือเป็น request แรก) sidecar ต้องข้ามขั้นตอน unload และประมวลผลได้ทันที
- **FR-004**: หลัง unload เสร็จ sidecar ต้องอัปเดต prompt hash เป็นค่าใหม่ก่อนประมวลผล
- **FR-005**: sidecar ต้อง log การ unload/reload พร้อมเหตุผล (prompt changed) เพื่อ audit trail
- **FR-006**: กรณี Ollama ไม่ตอบสนองต่อ unload request sidecar ต้อง fallback ไปประมวลผลตามปกติ (best-effort) และ log warning
- **FR-007**: prompt hash comparison ต้องครอบคลุมทั้งกรณี systemPrompt=None และ systemPrompt=string
- **FR-008**: sidecar ต้องใช้ asyncio.Lock เพื่อบังคับให้ OCR request ทีละตัว ป้องกัน race condition ระหว่าง unload กับ request ถัดไป โดย request ถัดไปต้องรอจนกว่า unload + reload + ประมวลผลเสร็จก่อน

### Key Entities

- **Prompt Hash**: hash ของ systemPrompt text (SHA-256 16 chars) — เก็บใน Redis เพื่อรองรับ multi-worker/multi-process ในอนาคต ไม่ใช่ process-level variable
- **Unload Request**: HTTP POST ไป Ollama `/v1/chat/completions` พร้อม `keep_alive=0` และ `messages=[]` เพื่อบังคับ unload model

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: เมื่อ Admin เปลี่ยน OCR prompt แล้วส่ง OCR ภายใน 5 วินาที ผลลัพธ์ต้องเป็นไปตาม prompt ใหม่ 100% ของการทดสอบ
- **SC-002**: เมื่อส่ง OCR หลายไฟล์ด้วย prompt เดียวกัน ไฟล์ที่ 2 เป็นต้นไป ต้องไม่มี cold start (inference time < 50% ของไฟล์แรก)
- **SC-003**: การ unload ก่อน reload ใช้เวลาไม่เกิน 70 วินาที (cold start ปกติ ~65s + buffer)
- **SC-004**: sidecar log ต้องแสดงเหตุผลการ unload ชัดเจน เช่น "systemPrompt changed (hash_a1b2 → hash_c3d4) — forcing model unload"

## Assumptions

- โครงสร้าง payload และ Ollama API (`/v1/chat/completions`) ไม่เปลี่ยนแปลง
- `prepare_ocr_messages` จาก `typhoon_ocr` library ยังใช้ role `user` สำหรับ messages (ไม่มี separate `system` role)
- Ollama รองรับ unload ผ่านการส่ง request พร้อม `keep_alive=0` (พฤติกรรมที่ผู้ใช้ยืนยันจากการทดลอง)
- การแก้ไขจะทำที่ sidecar (`app.py`) เป็นหลัก ไม่ต้องแก้ Backend NestJS
- New Server (RTX 5060 Ti 16GB) จะทำให้ `keep_alive > 0` เป็นจริง ทำให้ปัญหานี้เกิดขึ้นใน production
- sidecar ไม่มี Redis connection ในปัจจุบัน — ต้องเพิ่ม `redis>=5.0.0` ใน requirements.txt และ `REDIS_URL` env var ใน docker-compose.yml

## Dependencies

- **MIGRATION-PLAN.md (ADR-041)**: New Server มี RTX 5060 Ti 16GB VRAM → `keep_alive > 0` จะใช้ได้จริง → ปัญหานี้ต้องแก้ก่อน migration
- **ADR-029 Dynamic Prompt Management**: Prompt จัดการผ่าน DB `ai_prompts` + Redis cache → การเปลี่ยน prompt เกิดได้ทุกเมื่อโดยไม่ต้อง redeploy
- **ADR-034/ADR-036**: np-dms-ocr:latest เป็น canonical OCR model ใน Ollama
- **OCR Sidecar app.py**: ไฟล์หลักที่ต้องแก้ไข — `process_ocr()` function
