// File: specs/200-fullstacks/241-ocr-persist-sandbox/plan.md
// Change Log:
// - 2026-07-27: Initial implementation plan for OCR Text Persistence & Sandbox Project

# Implementation Plan: OCR Text Persistence & Sandbox Project (Full-Pipeline Testing)

**Branch**: `241-ocr-persist-sandbox` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/241-ocr-persist-sandbox/spec.md`

**Note**: This plan derives from `specs/06-Decision-Records/ADR-042-sandbox-project-and-ocr-text-persistence.md` — decisions already resolved via `grill-with-docs` session ก่อนเข้า speckit pipeline

## Summary

แยก `rag-prepare` BullMQ job เป็น 2 jobs: (1) OCR-extract-persist — เขียน `attachments.ocr_text` ก่อนเสมอ (2) `embed-document` — รับ `extractedText` เพื่อข้าม OCR ซ้ำเมื่อ retry ควบคู่กับการเพิ่ม "Sandbox Project" (`projects.is_sandbox`) ให้ Admin สามารถเดินโค้ด Production Flow จริง (upload → create → submit) แบบ commit DB ได้ในพื้นที่แยก พร้อม endpoint ลบข้อมูลทดสอบ (`clear-data`) ที่ cascade delete + enqueue vector deletion

## Technical Context

**Language/Version**: TypeScript 5.7 (Backend: NestJS 11, Frontend: Next.js 16)
**Primary Dependencies**: NestJS, TypeORM, BullMQ, Redis, TanStack Query, React Hook Form
**Storage**: MariaDB 11.8 (`attachments.ocr_text` LONGTEXT ใหม่, `projects.is_sandbox` TINYINT ใหม่), Qdrant (vector deletion scope)
**Testing**: Jest (backend unit/integration), Playwright (frontend e2e ถ้ามี)
**Target Platform**: Linux server (`np-dms-lcbp3`, ADR-041)
**Project Type**: web (fullstack: backend + frontend)
**Performance Goals**: ไม่มี SLA ใหม่ — OCR/embedding ใช้เวลาเท่าเดิม เพิ่มแค่ 1 UPDATE query ต่อ job (persist step)
**Constraints**: ADR-009 (SQL delta ไม่ใช้ migration), ADR-019 (publicId เป็น key ไม่ใช่ file_path), ADR-008 (BullMQ ไม่ inline), ADR-036 (Production Pipeline Sandbox เดิมต้องไม่กระทบ), ADR-042 (Sandbox Project ใหม่)
**Scale/Scope**: 1 sandbox project (seed แถวเดียว), Admin-only feature (`system.manage_all`)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Status | Justification |
|------|--------|--------------|
| ADR-009: No TypeORM migrations | ✅ PASS | Schema changes ผ่าน SQL delta (`deltas/2026-07-27-add-ocr-text-and-sandbox-project.sql`) |
| ADR-019: UUID handling | ✅ PASS | ใช้ `attachmentPublicId` เป็น WHERE key แทน `file_path`; ไม่มี `parseInt`/`Number` บน UUID |
| ADR-016: Security | ✅ PASS | `clear-data` endpoint guard ด้วย `system.manage_all` (CASL); ไม่กระทบ two-phase upload เดิม |
| ADR-008: BullMQ | ✅ PASS | ทุก job (OCR-persist, embed-document, vector-deletion) ยังผ่าน BullMQ ไม่มี inline call |
| ADR-023/023A: AI boundary | ✅ PASS | ไม่เปลี่ยน AI boundary — Ollama/sidecar ยังถูกเรียกจาก backend เท่านั้น |
| ADR-036: Production Pipeline Sandbox (ไม่แก้ไข) | ✅ PASS | 3 endpoint เดิม (`/ocr`, `/ai-extract`, `/rag-prep`) ไม่ถูกแก้ logic เลย |
| ADR-042: Sandbox Project (ใหม่, Proposed) | ✅ PASS | Feature นี้คือการ implement ADR-042 โดยตรง |
| ADR-007: Error handling | ✅ PASS | `processRagPrepare` ยังคง throw ให้ BullMQ retry ตามเดิม; `clear-data` ใช้ `BusinessException` ปกติ |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/241-ocr-persist-sandbox/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── backend-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── common/
│   │   └── file-storage/
│   │       └── entities/
│   │           └── attachment.entity.ts                  # MODIFY: +ocrText?: string
│   ├── modules/
│   │   ├── project/
│   │   │   ├── entities/project.entity.ts                # MODIFY: +isSandbox: boolean
│   │   │   └── project.service.ts                        # MODIFY: findAll() filter isSandbox=false
│   │   ├── correspondence/
│   │   │   └── correspondence-workflow.service.ts         # MODIFY: triggerRagPrepare() +attachmentPublicId
│   │   └── ai/
│   │       ├── ai-queue.service.ts                        # MODIFY: +attachmentPublicId payload, +enqueueEmbedDocument()
│   │       ├── ai.controller.ts                           # MODIFY: +POST admin/sandbox/clear-data (Idempotency-Key required)
│   │       ├── ai.service.ts                               # MODIFY: +clearSandboxData()
│   │       └── processors/
│   │           └── ai-batch.processor.ts                  # MODIFY: processRagPrepare() persist+enqueue split
│   └── tests/
│       └── modules/
│           ├── correspondence/correspondence-workflow.service.spec.ts  # MODIFY: assert attachmentPublicId
│           ├── project/project.service.spec.ts             # MODIFY: assert isSandbox filter
│           └── ai/
│               ├── ai-batch.processor.spec.ts              # MODIFY: assert persist-before-enqueue
│               └── ai.service.spec.ts                      # NEW: clearSandboxData tests

frontend/
├── components/
│   └── admin/ai/SandboxTabs.tsx                            # MODIFY: +Tab 0 Full Pipeline, +Clear Sandbox Data button
└── lib/services/admin-ai.service.ts                        # MODIFY: +clearSandboxData()

specs/03-Data-and-Storage/
└── deltas/
    └── 2026-07-27-add-ocr-text-and-sandbox-project.sql     # NEW: schema changes + seed sandbox project

specs/06-Decision-Records/
└── ADR-042-sandbox-project-and-ocr-text-persistence.md     # ✅ สร้างแล้ว (ก่อนเข้า speckit pipeline)
```

**Structure Decision**: Web application (fullstack) — เปลี่ยนแปลงกระจุกอยู่ที่ `backend/src/modules/ai/` (job split logic) และ `backend/src/modules/project/` (sandbox flag) เป็นหลัก ฝั่ง frontend แก้แค่ 1 component (`SandboxTabs.tsx`) + 1 service ไม่มีการเพิ่ม module ใหม่

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All gates passed.
