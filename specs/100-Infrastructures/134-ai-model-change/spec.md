// File: specs/100-Infrastructures/134-ai-model-change/spec.md
// Change Log:
// - 2026-06-03: Initial specification for Thai-Optimized AI Model Stack (ADR-034)

# Feature Specification: Thai-Optimized AI Model Stack

**Feature Branch**: `134-ai-model-change`
**Created**: 2026-06-03
**Status**: Draft
**Category**: 100-Infrastructures
**ADR Reference**: ADR-034 (Supersedes ADR-023A Section 2.1)
**Input**: User description: "Implement ADR-034 — Switch AI model stack from gemma4:e2b to Thai-optimized Typhoon series: typhoon2.5-np-dms:latest (main AI) + typhoon-np-dms-ocr:latest (Thai OCR). Requires model switching logic in BullMQ processor, new unload/load methods in OllamaService, updated default model config. VRAM budget: RTX 2060 Super 8GB."

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Thai OCR Extraction With New OCR Model (Priority: P1)

ในฐานะ DevOps Engineer ฉันต้องการให้งาน OCR ภาษาไทยใช้ Typhoon OCR-3B ที่ถูก fine-tune มาสำหรับภาษาไทย เพื่อให้ข้อความที่สกัดจาก PDF ภาษาไทยมีความแม่นยำสูงกว่า gemma4:e2b

**Why this priority**: งาน OCR ภาษาไทยคือจุดอ่อนหลักของระบบปัจจุบัน การเปลี่ยนเป็น Typhoon OCR model จะส่งผลโดยตรงต่อคุณภาพการ extract metadata และ text จากเอกสาร

**Independent Test**: ส่ง OCR job (`jobType: 'ocr-extract'`) เข้า BullMQ ด้วย PDF ภาษาไทย และตรวจสอบว่า (1) job สำเร็จโดยไม่มี VRAM OOM error (2) ข้อความ OCR อ่านออกได้ (3) หลัง OCR เสร็จ main model ยังพร้อมใช้งาน

**Acceptance Scenarios**:

1. **Given** `typhoon-np-dms-ocr:latest` ถูก create บน Desk-5439, **When** BullMQ ได้รับ job `ocr-extract` หรือ `sandbox-ocr-only`, **Then** processor unload main model → load OCR model (keep_alive:0) → ประมวลผล → OCR model unload อัตโนมัติ
2. **Given** OCR job เสร็จแล้ว, **When** main model job เข้ามาต่อ, **Then** processor reload main model และประมวลผลสำเร็จภายใน 60 วินาที
3. **Given** VRAM ถูกใช้งานสูงขณะมี OCR job, **When** job เข้าคิว, **Then** BullMQ concurrency=1 ป้องกัน VRAM overflow — ไม่เกิด OOM error

---

### User Story 2 — General AI Tasks Use Thai-Optimized Main Model (Priority: P2)

ในฐานะ DevOps Engineer ฉันต้องการให้ระบบ AI ใช้ `typhoon2.5-np-dms:latest` เป็น main model สำหรับงาน extraction, RAG Q&A, และ AI suggestion แทน gemma4:e2b เพื่อประสิทธิภาพภาษาไทยที่ดีขึ้น

**Why this priority**: เมื่อ OCR ทำงานได้แล้ว ต้องมั่นใจว่า AI extraction/RAG ที่ใช้ main model ทำงานได้กับโมเดลใหม่

**Independent Test**: ส่ง `ai-extract` job เข้า BullMQ → ตรวจสอบว่า backend เรียก `typhoon2.5-np-dms:latest` (ไม่ใช่ `gemma4:e2b`) และได้ผลลัพธ์ที่ถูกต้อง

**Acceptance Scenarios**:

1. **Given** `typhoon2.5-np-dms:latest` ถูก create บน Desk-5439, **When** backend start up, **Then** `AiSettingsService.DEFAULT_MODEL = 'typhoon2.5-np-dms:latest'`
2. **Given** main model พร้อม, **When** ส่ง extraction/RAG/suggestion job, **Then** ผลลัพธ์ return โดยไม่มี "model not found" error
3. **Given** การ reload main model หลัง OCR job, **When** warm reload, **Then** ใช้เวลา ≤ 60 วินาที (cold start acceptable)

---

### User Story 3 — System Health Reflects New Model Stack (Priority: P3)

ในฐานะ AI Admin ฉันต้องการเห็นสถานะของ model stack ใหม่ใน AI Admin Console เพื่อยืนยันว่าระบบทำงานถูกต้องหลัง deploy

**Why this priority**: Operations team ต้องการ observability เพื่อตรวจสอบหลัง deployment

**Independent Test**: เปิด AI Admin Console → System Health → เห็นชื่อ `typhoon2.5-np-dms` และ `typhoon-np-dms-ocr` แทน gemma4

**Acceptance Scenarios**:

1. **Given** backend รันกับ model stack ใหม่, **When** GET `/api/ai/health`, **Then** response แสดง main model = `typhoon2.5-np-dms:latest` และ ocr model = `typhoon-np-dms-ocr:latest`
2. **Given** มี model switching เกิดขึ้น, **When** ดู BullMQ job logs, **Then** เห็น log บันทึก unload/load พร้อม model name และ timestamp

---

### Edge Cases

- VRAM เต็ม (>8GB) ขณะ load OCR model → BullMQ retry; ไม่ crash; error log ชัดเจน
- Ollama API timeout ขณะ `unloadModel`/`loadModel` → throw descriptive error; ไม่ swallow silently
- โมเดล `typhoon2.5-np-dms` ไม่ถูก create บน Desk-5439 → backend start ได้; job fail พร้อม clear "model not found" error
- OCR job และ main job เข้าคิวพร้อมกัน → BullMQ concurrency=1 handle อยู่แล้ว; ไม่ต้องแก้
- Cold start OCR (30–60s) ขณะ user รอ → ยอมรับได้; job polling แสดงสถานะ

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST ใช้ `typhoon2.5-np-dms:latest` เป็น default main model สำหรับทุก AI job ที่ไม่ใช่ OCR
- **FR-002**: ระบบ MUST ใช้ `typhoon-np-dms-ocr:latest` เฉพาะ job type `ocr-extract` และ `sandbox-ocr-only`
- **FR-003**: BullMQ processor MUST unload main model ก่อน load OCR model ทุกครั้งที่มี OCR job
- **FR-004**: OCR model MUST unload อัตโนมัติหลัง job เสร็จ (keep_alive: 0)
- **FR-005**: หลัง OCR job เสร็จ processor MUST reload main model (keep_alive: -1 หรือ indefinite)
- **FR-006**: OllamaService MUST expose `unloadModel(modelName)` และ `loadModel(modelName, keepAlive?)` methods
- **FR-007**: `AiSettingsService.DEFAULT_MODEL` MUST hardcoded เป็น `'typhoon2.5-np-dms:latest'` (ตาม ADR-034)
- **FR-008**: Embedding model `nomic-embed-text` MUST ไม่เปลี่ยนแปลง (นอก scope)
- **FR-009**: n8n MUST ไม่เรียก Ollama โดยตรง — ยังคง pattern `POST /api/ai/jobs` → BullMQ (ADR-023A)
- **FR-010**: BullMQ concurrency MUST = 1 เพื่อป้องกัน VRAM overflow

### Key Entities

- **Custom Ollama Model `typhoon2.5-np-dms`**: Configuration ของ main AI model — base: typhoon2.5-qwen3-4b, keep_alive: indefinite, size ~2.5GB
- **Custom Ollama Model `typhoon-np-dms-ocr`**: Configuration ของ OCR model — base: typhoon-ocr1.5-3b, keep_alive: 0, size ~3.2GB
- **OllamaService.unloadModel / loadModel**: Methods สำหรับ explicit model management ผ่าน Ollama API
- **AiSettingsService.DEFAULT_MODEL**: Hardcoded constant ชี้ไปยัง main model ใหม่

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: OCR job ประมวลผล PDF ภาษาไทยได้ข้อความที่อ่านออกได้ (ไม่มี garbled Thai characters) > 90% ของ pages
- **SC-002**: ไม่มี VRAM OOM error ตลอดการ process OCR + main jobs ต่อเนื่อง 10 jobs
- **SC-003**: OCR cold start ≤ 60 วินาที; main model warm response ≤ 5 วินาที
- **SC-004**: Deploy custom models บน Desk-5439 (`ollama create`) ใช้เวลา ≤ 15 นาทีต่อ model (download ขึ้นกับ network)
- **SC-005**: ไม่มี regression ใน AI extraction/RAG functionality ที่เดิมทำงานได้

---

## Assumptions

- **A1**: Desk-5439 มี internet access สำหรับ pull base models (`scb10x/typhoon*`) จาก Ollama registry
- **A2**: ADR-033 VRAM monitoring mechanism ใช้งานได้กับ Typhoon models
- **A3**: Custom Modelfiles ถูก define ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/` แล้ว
- **A4**: Embedding model `nomic-embed-text` ไม่เปลี่ยนแปลง
- **A5**: `ai_available_models` table (ADR-027) จำเป็นต้อง update seed เพื่อแสดง model ใหม่ใน admin console

---

## Clarifications

### Session 2026-06-03

- Q: nomic-embed-text embedding model เปลี่ยนหรือไม่? → A: ไม่เปลี่ยน — ADR-034 supersedes LLM stack เท่านั้น
- Q: Keep-alive value สำหรับ main model หลัง reload คือเท่าไร? → A: -1 (indefinite) ตาม ADR-034 "Stand by ตลอด (ไม่ใช่ 0)"
- Q: `sandbox-ocr-only` ต้องใช้ OCR model switching ด้วยหรือไม่? → A: ใช่ — เป็น OCR job type เหมือน `ocr-extract`
