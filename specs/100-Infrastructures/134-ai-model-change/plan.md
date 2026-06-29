// File: specs/100-Infrastructures/134-ai-model-change/plan.md
// Change Log:
// - 2026-06-03: Initial implementation plan for Thai-Optimized AI Model Stack (ADR-034)

# Implementation Plan: Thai-Optimized AI Model Stack

**Branch**: `134-ai-model-change` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/100-Infrastructures/134-ai-model-change/spec.md`

---

## Summary

เปลี่ยน AI model stack จาก `gemma4:e2b` เป็น custom Typhoon models: `typhoon2.5-np-dms:latest` (main AI) + `typhoon-np-dms-ocr:latest` (Thai OCR) ตาม ADR-034. ต้อง implement:
1. Custom Modelfiles บน Desk-5439 (มีอยู่แล้วใน `specs/04-Infrastructure-OPS/...`)
2. `unloadModel()` + `loadModel()` ใน `OllamaService`
3. Model switching logic ใน `ai-batch.processor.ts`
4. อัปเดต `AiSettingsService.DEFAULT_MODEL`
5. SQL delta สำหรับ `ai_available_models` table

---

## Technical Context

**Language/Version**: TypeScript 5.x, NestJS 11, Node.js 20
**Primary Dependencies**: `@nestjs/bull`, `bullmq`, `axios` (Ollama HTTP client), Redis
**Storage**: ไม่มี schema changes — optional SQL delta สำหรับ `ai_available_models` seed
**Testing**: Jest (unit tests: OllamaService methods + ai-batch.processor switching)
**Target Platform**: QNAP NAS backend (Docker) + Desk-5439 (Ollama runtime, RTX 2060 Super 8GB)
**Performance Goals**: OCR cold start ≤ 60s; main model warm ≤ 5s; zero VRAM OOM
**Constraints**: VRAM ≤ 8GB; BullMQ concurrency=1; ADR-033 VRAM monitor preserved; ADR-023A AI boundary
**Scale/Scope**: 1 Desk-5439 Ollama instance; 1 concurrent AI job at a time (BullMQ)

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Rule | Status | Notes |
|------|--------|-------|
| ADR-019 UUID: ไม่มี parseInt บน UUID | ✅ PASS | ไม่มี UUID changes ใน feature นี้ |
| ADR-009 Schema: ไม่มี TypeORM migration | ✅ PASS | ไม่มี table ใหม่; SQL delta สำหรับ seed update เท่านั้น |
| ADR-023/023A AI Boundary: Ollama บน Desk-5439 | ✅ PASS | ยังคง pattern เดิม; ไม่มี direct DB/storage access |
| ADR-033 VRAM Monitor: mechanism ยังใช้งาน | ✅ PASS | ชื่อ model เปลี่ยน; mechanism เดิม |
| ADR-008 BullMQ: Background jobs ผ่าน queue | ✅ PASS | ไม่มี inline AI call ใหม่ |
| ADR-007 Error Handling: Error classification | ✅ PASS | unload/load errors ต้องมี descriptive messages |
| ADR-016 Security: CASL Guard | ✅ PASS | ไม่มี new public endpoints |
| Forbidden: console.log, any type | ✅ PASS | ต้องตรวจสอบขณะ implement (ESLint enforce) |

---

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/134-ai-model-change/
├── spec.md                               # Feature specification
├── plan.md                               # This file
├── research.md                           # Phase 0: decisions
├── data-model.md                         # Phase 1: config/model data
├── quickstart.md                         # Phase 1: verification guide
├── contracts/
│   └── ollama-service-methods.md         # Method signatures + Ollama API
├── checklists/
│   └── requirements.md                   # Spec quality checklist
└── tasks.md                              # Phase 2: task list
```

### Infrastructure Files (already exist)

```text
specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/
├── typhoon2.5-np-dms.model.md            # Main model Modelfile ✅ exists
└── typhoon-np-dms-ocr.model.md           # OCR model Modelfile  ✅ exists
```

### Source Code Changes

```text
backend/src/modules/ai/
├── services/
│   ├── ollama.service.ts                 # เพิ่ม unloadModel() + loadModel()
│   └── ai-settings.service.ts            # อัปเดต DEFAULT_MODEL + เพิ่ม OCR_MODEL
└── processors/
    └── ai-batch.processor.ts              # เพิ่ม OCR model switching logic
```

### Optional Delta

```text
specs/03-Data-and-Storage/deltas/
└── 2026-06-03-update-ai-available-models-typhoon.sql
```

**Structure Decision**: Web application (backend only) — ไม่มี frontend changes ที่จำเป็น; health UI อาจ update model names เองจาก dynamic data

---

## Phase 0: Research

ผลการ research ดู [research.md](./research.md) — decisions ถูก resolve จาก ADR-034 แล้ว

---

## Phase 1: Design & Contracts

### Data Model

ดู [data-model.md](./data-model.md)

- ไม่มี new DB entities
- Code constants ใน `AiSettingsService` อัปเดต
- Optional: `ai_available_models` seed delta

### API Contracts

ดู [contracts/ollama-service-methods.md](./contracts/ollama-service-methods.md)

- `OllamaService.unloadModel(modelName: string): Promise<void>`
- `OllamaService.loadModel(modelName: string, keepAlive?: number | string): Promise<void>`
- BullMQ processor switching pseudocode

### Quickstart Verification

ดู [quickstart.md](./quickstart.md)

---

## Complexity Tracking

ไม่มี Constitution Check violations ที่ต้องจัดการ
