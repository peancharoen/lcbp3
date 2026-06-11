// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/spec.md
// Change Log:
// - 2026-06-11: Initial specification for AI Runtime Policy Refactor (RTX 5060 Ti 16GB)

# Feature Specification: AI Runtime Policy Refactor

**Feature Branch**: `235-ai-runtime-policy-refactor`
**Created**: 2026-06-11
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User description from `docs/AI-Refactor.md` + `docs/0001-ai-runtime-policy-refactor.md`

## Overview

ปรับ AI runtime ของ LCBP3-DMS ให้รองรับ GPU ใหม่ (RTX 5060 Ti 16GB) โดยนำ canonical model identities (`np-dms-ai`, `np-dms-ocr`), policy-driven `executionProfile` contract, และ LLM-First GPU ownership มาใช้แทนระบบเดิมที่ caller เลือก model/parameter เองได้ และ keep_alive แบบ fixed ค่า

อ้างอิง: `docs/AI-Refactor.md`, `docs/0001-ai-runtime-policy-refactor.md`, ADR-033, ADR-034

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Policy Contract & Canonical Naming (Priority: P1)

นักพัฒนาและ admin ที่ส่ง AI job request ผ่าน AI Gateway จะส่งได้แค่ `executionProfile` (`fast | balanced | thai-accurate | large-context`) โดยไม่สามารถระบุชื่อ model หรือ override runtime parameters ได้เอง — system แสดงและบันทึก model ในทุก layer ด้วยชื่อ canonical `np-dms-ai` และ `np-dms-ocr` แทนชื่อ runtime เดิม

**Why this priority**: เป็นรากฐานของทุก workstream — ถ้า contract ยังเป็น caller-driven อยู่ workstream อื่นไม่มีความหมาย

**Independent Test**: ยิง POST ไปยัง AI Gateway endpoint ด้วย payload ที่มี `model.key` หรือ `temperature` แล้วตรวจว่า API reject 400 พร้อม error message; ยิงด้วย `executionProfile: "balanced"` แล้วตรวจว่าผ่านและ log/response แสดง `np-dms-ai`

**Acceptance Scenarios**:

1. **Given** AI job request ที่มี `model: { key: "typhoon2.5-np-dms:latest" }`, **When** ส่งไปยัง `POST /api/ai/jobs`, **Then** system ตอบ HTTP 400 พร้อมข้อความว่า field `model.key` ไม่อนุญาต
2. **Given** AI job request ที่มี `executionProfile: "balanced"`, **When** job ถูก dispatch ไปยัง `ai-batch` queue, **Then** job payload บันทึก `modelUsed: "np-dms-ai"` ใน audit log
3. **Given** admin เปิด AI Admin Console, **When** ดู model information panel, **Then** แสดงชื่อ `np-dms-ai` และ `np-dms-ocr` ไม่ใช่ชื่อ runtime จริง (เช่น `typhoon2.5-np-dms:latest`)
4. **Given** `auto-fill-document` job ถูกส่งมาพร้อม `executionProfile: "fast"`, **When** backend process job, **Then** backend override เป็น deterministic profile โดยไม่ใช้ค่า `fast` ที่ caller ส่งมา
5. **Given** `large-context` profile ถูกส่งโดย non-admin user, **When** backend validate, **Then** ตอบ HTTP 403 เพราะ profile นั้น restrict เฉพาะ admin/special workflows

---

### User Story 2 — Adaptive OCR Residency (Priority: P2)

Backend คำนวณ `keep_alive` value ของ `np-dms-ocr` แบบ dynamic ตาม VRAM headroom และ active workload ณ ขณะนั้น แทนการใช้ค่า fixed `keep_alive: 0` หรือ `keep_alive: 300` ตายตัว

**Why this priority**: แก้ปัญหา VRAM contention โดยตรง — ถ้า OCR ค้างอยู่ใน VRAM ตลอดจะบล็อก main model; ถ้า unload ทุกครั้งจะมี cold start penalty สูง 5–15 วินาที

**Independent Test**: รัน OCR job ขณะที่ `large-context` profile active และตรวจว่า `keep_alive: 0` ถูกส่งไป OCR sidecar; รัน OCR job ขณะที่ VRAM headroom สูงและตรวจว่าได้ residency window > 0

**Acceptance Scenarios**:

1. **Given** active job กำลังใช้ `large-context` profile, **When** OCR job เข้ามา, **Then** `keep_alive` ที่ส่งไป Ollama = `0`
2. **Given** ไม่มี active main model pressure และ VRAM headroom ≥ threshold, **When** OCR job เข้ามา, **Then** `keep_alive` ที่ส่งไป Ollama > `0` (residency window)
3. **Given** main model pressure สูง (high VRAM utilization), **When** OCR job เข้ามา, **Then** `keep_alive` = `0` เสมอ
4. **Given** OCR residency policy ทำงาน, **When** ดู trace/log ของ OCR request, **Then** log บันทึก residency decision พร้อม headroom value ที่ใช้ตัดสิน

---

### User Story 3 — Retrieval Acceleration with CPU Fallback (Priority: P3)

`/embed` และ `/rerank` endpoints บน OCR sidecar ตรวจสอบ VRAM headroom ก่อนใช้ GPU; ถ้า headroom ไม่ผ่าน policy threshold ให้ fallback ไป CPU ทันทีโดยไม่ fail และไม่รอ GPU queue

**Why this priority**: ป้องกัน RAG query ล้มเหลวในช่วงที่ GPU ถูกใช้งานสูง — retrieval ยังทำงานได้แค่ช้าลง

**Independent Test**: จำลอง GPU pressure สูงแล้วยิง RAG query — ตรวจว่า query ยังตอบได้ (อาจช้ากว่าปกติ) และ log บันทึก `"retrieval: cpu-fallback"`

**Acceptance Scenarios**:

1. **Given** GPU headroom < threshold, **When** `POST /embed` ถูกเรียก, **Then** ใช้ CPU compute โดยไม่ return error
2. **Given** GPU headroom < threshold, **When** `POST /rerank` ถูกเรียก, **Then** ใช้ CPU compute และ response ปกติ
3. **Given** fallback เกิดขึ้น, **When** ดู sidecar log, **Then** log entry มี `device: "cpu"` และ `reason: "gpu-headroom-below-threshold"`
4. **Given** `rag-query` job รัน, **When** GPU ถูก main model ใช้งานอยู่, **Then** RAG query ยังตอบ response ได้ (ไม่ timeout หรือ fail hard)

---

### User Story 4 — Queue Policy & Selective Realtime Concurrency (Priority: P4)

BullMQ queue ปรับให้ `ai-realtime` รองรับ concurrency = 2 ได้เฉพาะ lightweight realtime jobs (intent classification ที่ไม่เรียก OCR, tool-only suggestion ที่ไม่ต้อง model switching) โดยยังคง pause/resume coordination เดิม และ `rag-query` ยังถูก classify เป็น generation-centric job ที่อยู่ใน `ai-batch`

**Why this priority**: เพิ่ม throughput ให้ lightweight jobs โดยไม่กระทบ GPU safety

**Independent Test**: ส่ง intent classification job 2 อันพร้อมกัน ตรวจว่าทั้งสองรันพร้อมกันได้ใน `ai-realtime`; ส่ง `rag-query` ตรวจว่าไปอยู่ใน `ai-batch` ไม่ใช่ `ai-realtime`

**Acceptance Scenarios**:

1. **Given** 2 intent classification jobs เข้ามาพร้อมกัน, **When** ทั้งคู่ถูก dispatch, **Then** ทั้งคู่ process พร้อมกันใน `ai-realtime` queue (concurrency = 2)
2. **Given** `rag-query` job เข้ามา, **When** dispatch, **Then** job ถูกส่งไป `ai-batch` queue ไม่ใช่ `ai-realtime`
3. **Given** `ai-batch` ถูก pause เนื่องจาก realtime pressure, **When** pause/resume coordination ทำงาน, **Then** `ai-realtime` ยังคง concurrency = 2 ได้สำหรับ lightweight jobs

---

### User Story 5 — Verification & Cutover Gate (Priority: P5)

ระบบมี automated tests และ manual validation checklist ครบตามทั้ง 4 แกน (policy contract, canonical naming, adaptive OCR residency, retrieval fallback) ก่อนถือว่า big bang cutover สำเร็จ — ไม่อนุญาต partial success

**Why this priority**: เป็น safety net ของทั้ง refactor — partial cutover อาจทำให้ระบบ inconsistent

**Independent Test**: รัน test suite ที่ครอบคลุมทั้ง 4 แกนแล้วทุก test ผ่าน; admin สามารถเปิด AI Admin Console และ OCR Sandbox ตรวจ label/behavior จริงได้

**Acceptance Scenarios**:

1. **Given** test suite รัน, **When** ทุก test ผ่าน, **Then** cutover gate ถือว่าผ่านในส่วน executable verification
2. **Given** admin เปิด AI Admin Console, **When** ดู model labels ทั้งหมด, **Then** ไม่มีชื่อ `typhoon2.5-np-dms:latest` หรือ `typhoon-np-dms-ocr:latest` ปรากฏใน UI
3. **Given** admin รัน OCR Sandbox ซ้ำหลาย job ในเงื่อนไข headroom ต่างกัน, **When** ดู behavior, **Then** `keep_alive` ต่างกันตาม policy ที่ defined

---

### Edge Cases

- ถ้า VRAM headroom calculation service ล้มเหลว (timeout หรือ error) → ต้อง fallback เป็น `keep_alive: 0` เสมอ (safe default)
- ถ้า caller ส่ง `executionProfile` ที่ไม่อยู่ใน canonical set → ตอบ 400 validation error
- ถ้า `large-context` profile ถูก whitelist ให้ admin แต่ VRAM ไม่พอ → backend ต้อง reject พร้อม error ชัดเจน ไม่ใช่ silent fallback
- ถ้า OCR job เข้ามาพร้อมกับ main model generation job → LLM-First rule บังคับ: OCR ต้องรอหรือใช้ `keep_alive: 0`
- ถ้า `/embed` fallback ไป CPU แล้ว job ใช้เวลานานเกิน timeout → ต้อง return partial result หรือ error ที่ชัดเจน ไม่ใช่ hang

---

## Requirements _(mandatory)_

### Functional Requirements

**Workstream A: Contract & Canonical Naming**

- **FR-A01**: System MUST reject AI job requests ที่มี `model.key` field ใน payload (HTTP 400)
- **FR-A02**: System MUST reject AI job requests ที่มี direct `temperature`, `top_p`, หรือ `maxTokens` overrides (HTTP 400)
- **FR-A03**: `executionProfile` MUST รับค่าได้เฉพาะ `fast | balanced | thai-accurate | large-context`
- **FR-A04**: `large-context` profile MUST ถูก authorize เฉพาะ admin role หรือ backend-whitelisted workflows
- **FR-A05**: System MUST map `executionProfile` → canonical model name และ runtime parameters ใน backend policy layer
- **FR-A06**: งาน data-affecting (`migrate-document`, `auto-fill-document`) MUST ถูก backend override profile โดยไม่ใช้ค่าที่ caller ส่งมา
- **FR-A07**: ทุก layer (API response, audit log, Admin Console, OCR Sandbox) MUST แสดงชื่อ `np-dms-ai` และ `np-dms-ocr` แทนชื่อ runtime จริง

**Workstream B: Runtime Policy**

- **FR-B01**: Backend MUST มี policy mapping: `executionProfile` → `{ canonicalModel, keep_alive, temperature, top_p, maxTokens }`
- **FR-B02**: OCR residency MUST คำนวณ `keep_alive` แบบ dynamic จาก VRAM headroom และ active profile
- **FR-B03**: ถ้า active profile = `large-context` หรือ main model pressure = high → OCR `keep_alive` MUST = `0`
- **FR-B04**: ถ้า VRAM headroom ≥ policy threshold → OCR สามารถใช้ residency window > 0
- **FR-B05**: VRAM headroom calculation ล้มเหลว → MUST fallback เป็น `keep_alive: 0` (safe default)
- **FR-B06**: OCR residency decision MUST ถูก log พร้อม headroom value ที่ใช้ตัดสิน

**Workstream C: Retrieval Acceleration**

- **FR-C01**: `/embed` endpoint MUST ตรวจ VRAM headroom ก่อน GPU compute; ถ้าไม่ผ่าน → fallback CPU
- **FR-C02**: `/rerank` endpoint MUST ตรวจ VRAM headroom ก่อน GPU compute; ถ้าไม่ผ่าน → fallback CPU
- **FR-C03**: CPU fallback MUST ไม่ hard fail และ MUST ไม่รอ GPU queue — ถ้า CPU compute timeout ต้อง return HTTP 504 พร้อม error message ชัดเจน (ไม่ return partial result)
- **FR-C04**: Fallback event MUST ถูก log พร้อม `device: "cpu"` และ `reason`
- **FR-C05**: `rag-query` job MUST ยังตอบได้เมื่อ GPU retrieval path ถูก fallback ไป CPU
- **FR-C06**: VRAM headroom threshold MUST เป็น configurable env variable (`VRAM_HEADROOM_THRESHOLD_MB`) — ถ้า VRAM query ล้มเหลว ให้ใช้ safe default = 0 MB (บังคับ fallback)

**Workstream D: Queue Policy**

- **FR-D01**: `ai-realtime` queue MUST รองรับ concurrency = 2 สำหรับ lightweight realtime jobs
- **FR-D02**: Lightweight realtime jobs ได้แก่: intent classification (ไม่เรียก OCR), tool-only suggestion (ไม่ต้อง model switching)
- **FR-D03**: `rag-query` MUST ถูก dispatch ไป `ai-batch` ไม่ใช่ `ai-realtime`
- **FR-D04**: pause/resume coordination ระหว่าง `ai-realtime` และ `ai-batch` MUST ยังคงทำงานได้ตามเดิม

### Key Entities

- **ExecutionProfile**: Enum value ที่ caller ส่งมา (`fast | balanced | thai-accurate | large-context`) — contract ระดับ API
- **RuntimePolicy**: Backend mapping จาก `ExecutionProfile` → `{ canonicalModel, keep_alive, temperature, top_p, maxTokens }` — ไม่ expose ใน API
- **VramHeadroom**: ค่า computed ณ เวลา request ที่ใช้ตัดสิน OCR residency และ retrieval acceleration — บันทึกใน log
- **CanonicalModelIdentity**: ชื่อ `np-dms-ai` หรือ `np-dms-ocr` — ใช้ทุกชั้นที่ผู้ใช้เห็น
- **OcrResidencyDecision**: ผลการคำนวณ `keep_alive` value สำหรับ OCR job แต่ละครั้ง — บันทึกใน log พร้อม input factors

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: AI job requests ที่มี `model.key` หรือ parameter overrides ถูก reject 100% ในทุก environment
- **SC-002**: ทุก layer ที่ผู้ใช้และนักพัฒนาเห็น (API response, audit log, Admin Console, OCR Sandbox) แสดงชื่อ `np-dms-ai` / `np-dms-ocr` 100% โดยไม่มีชื่อ runtime รั่วออกมา
- **SC-003**: OCR cold start penalty ลดลงจากการใช้ adaptive residency ในสถานการณ์ที่ VRAM headroom เพียงพอ (วัดจาก average OCR latency ใน non-contention scenario)
- **SC-004**: RAG query ยังตอบ response ได้ 100% แม้ GPU retrieval path ถูก fallback ไป CPU (ไม่มี hard failure)
- **SC-005**: Automated test suite ครอบคลุมทั้ง 4 แกนของ cutover gate ผ่าน 100%
- **SC-006**: lightweight realtime job throughput เพิ่มขึ้น (สามารถ process 2 concurrent lightweight jobs) ขณะที่ pause/resume coordination ยังทำงานได้

---

## Clarifications

### Session 2026-06-11

- Q: ถ้า `/embed` fallback ไป CPU แล้ว job ใช้เวลานานเกิน timeout → ควร return partial result หรือ return error ที่ชัดเจน? → A: Return error ที่ชัดเจนพร้อม HTTP 504 timeout message — ไม่ return partial result เพราะ downstream LLM context จะ incomplete และทำให้ผลลัพธ์ผิดพลาดโดยไม่รู้ตัว
- Q: VRAM headroom threshold ระดับ spec ควรกำหนด default value ไหม? → A: ไม่กำหนดใน spec — threshold เป็น operational config (env variable `VRAM_HEADROOM_THRESHOLD_MB`) ที่ ops/admin ปรับได้ runtime; spec ระบุแค่ว่า "ต้องมี threshold ที่ configurable" และ "ต้องใช้ safe default = 0 (unload) เมื่อ query ล้มเหลว"

## Assumptions

- GPU ปัจจุบัน (RTX 5060 Ti 16GB) รองรับ VRAM monitoring API ที่ Ollama หรือ sidecar สามารถ query ได้
- VRAM headroom threshold ค่าเริ่มต้นจะถูกกำหนดใน config/env และปรับได้โดยไม่ต้อง redeploy
- Canonical model names (`np-dms-ai`, `np-dms-ocr`) ถูก tag ใน Ollama registry บน Desk-5439 ก่อน cutover
- OCR sidecar (`app.py`) บน Desk-5439 จะถูก update เป็นส่วนหนึ่งของ cutover
- Big bang rollout: ไม่มี parallel legacy path — ทุก change deploy พร้อมกันในรอบเดียว
- `ai-realtime` concurrency uplift เป็น configuration change ไม่ใช่ architectural change ใหม่
