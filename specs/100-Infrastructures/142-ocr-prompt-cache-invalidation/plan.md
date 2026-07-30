// File: specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/plan.md
// Change Log:
// - 2026-07-23: Initial implementation plan for OCR Prompt Cache Invalidation

# Implementation Plan: OCR Prompt Cache Invalidation

**Branch**: `142-ocr-prompt-cache-invalidation` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/spec.md`

## Summary

เมื่อ Ollama model ค้างใน VRAM (keep_alive > 0) การเปลี่ยน system prompt ใน payload ไม่มีผล เพราะ KV cache ยึด context เดิม ต้อง unload/reload model ถึงจะใช้ system prompt ใหม่ได้ แผนนี้เพิ่ม prompt hash tracking ใน Redis, automatic unload detection, และ asyncio.Lock สำหรับ sequential OCR processing ที่ sidecar

## Technical Context

**Language/Version**: Python 3.11 (sidecar FastAPI)
**Primary Dependencies**: FastAPI 0.111, httpx 0.27, typhoon-ocr >=0.4.1, PyMuPDF 1.24, redis-py (ใหม่)
**Storage**: Redis (prompt hash cross-process), Ollama (model VRAM)
**Testing**: pytest + httpx AsyncClient
**Target Platform**: Linux server (Docker container — ocr-sidecar)
**Project Type**: single (Python FastAPI sidecar)
**Performance Goals**: unload + reload < 70s, hot path inference < 50% ของ cold start
**Constraints**: sidecar รัน single-process (uvicorn workers=1), Redis ต้อง reachable จาก sidecar container
**Scale/Scope**: 1 file หลัก (app.py) + 1 module ใหม่ (prompt_cache.py) + requirements.txt + docker-compose.yml

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Rule | Status | Notes |
|------|--------|-------|
| ADR-019 UUID | ✅ Pass | ไม่เกี่ยวข้อง — ไม่มี UUID handling |
| ADR-009 Schema | ✅ Pass | ไม่เกี่ยวข้อง — ไม่มี DB schema change |
| ADR-016 Security | ✅ Pass | ไม่เพิ่ม endpoint ใหม่ — แก้ไข logic ภายใน existing endpoint |
| ADR-023/023A AI Boundary | ✅ Pass | ไม่เปลี่ยน AI boundary — แก้ที่ sidecar เท่านั้น |
| ADR-029 Dynamic Prompts | ✅ Pass | สอดคล้อง — รองรับ dynamic prompt ที่เปลี่ยนได้โดยไม่ redeploy |
| ADR-007 Error Handling | ✅ Pass | FR-006 ระบุ fallback + log warning สำหรับ unload failure |
| No `any` / `console.log` | ✅ Pass | Python sidecar — ใช้ `logging` ไม่ใช่ `console.log` |

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (pending /speckit-tasks)
```

### Source Code (repository root)

```text
specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/
├── app.py                    # แก้ไข: เพิ่ม asyncio.Lock + prompt hash check ใน process_ocr()
├── services/
│   ├── prompt_cache.py       # ใหม่: Redis-based prompt hash storage + unload logic
│   ├── residency_policy.py   # ไม่แก้
│   └── vram_monitor.py       # ไม่แก้
└── requirements.txt          # แก้ไข: เพิ่ม redis>=5.0.0

# ไฟล์ที่อยู่นอก ocr-sidecar/ directory:
# 04-ai/docker-compose.yml    # แก้ไข: เพิ่ม REDIS_URL env var ใน ocr-sidecar service
```

**Structure Decision**: แก้ที่ sidecar เป็นหลัก — เพิ่ม `services/prompt_cache.py` สำหรับแยก logic prompt hash + unload ออกจาก `app.py` เพื่อ testability

## Complexity Tracking

ไม่มี Constitution Check violations
