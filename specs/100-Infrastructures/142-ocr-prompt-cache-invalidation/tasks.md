// File: specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/tasks.md
// Change Log:
// - 2026-07-23: Initial task list for OCR Prompt Cache Invalidation

# Tasks: OCR Prompt Cache Invalidation

**Input**: Design documents from `/specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **OCR Sidecar**: `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/`
- **Docker Compose**: `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: เพิ่ม Redis dependency และ configuration สำหรับ prompt hash storage

- [x] T001 เพิ่ม `redis>=5.0.0` ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/requirements.txt`
- [x] T002 เพิ่ม `REDIS_URL` environment variable ใน docker-compose.yml สำหรับ ocr-sidecar service ที่ `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/docker-compose.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: สร้าง prompt cache module ที่จำเป็นสำหรับทุก user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 สร้าง `services/prompt_cache.py` — Redis client init (async), `get_prompt_hash()` และ `set_prompt_hash()` ที่ `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/services/prompt_cache.py`
- [x] T004 สร้าง `compute_prompt_hash()` function ใน `services/prompt_cache.py` — SHA-256 16 hex chars รองรับ systemPrompt=None (hash เป็น "none")
- [x] T005 สร้าง `unload_ollama_model()` function ใน `services/prompt_cache.py` — POST `/v1/chat/completions` พร้อม `messages=[]`, `keep_alive=0` ไป Ollama พร้อม error handling (FR-006 fallback + log warning)
- [x] T006 สร้าง `check_and_unload_if_changed()` function ใน `services/prompt_cache.py` — เปรียบเทียบ hash, หากเปลี่ยน → call `unload_ollama_model()` → update Redis hash → log (FR-001 ถึง FR-005)

**Checkpoint**: prompt_cache module พร้อมใช้ — user story implementation can now begin

---

## Phase 3: User Story 1 - Admin เปลี่ยน OCR Prompt แล้วส่ง OCR ใหม่ (Priority: P1) 🎯 MVP

**Goal**: เมื่อ Admin เปลี่ยน prompt แล้วส่ง OCR ผลลัพธ์ต้องเป็นไปตาม prompt ใหม่ 100%

**Independent Test**: เปลี่ยน prompt ใน Admin Console → ส่ง PDF เข้า OCR → ตรวจสอบผลลัพธ์ว่าใช้ prompt ใหม่

### Implementation for User Story 1

- [x] T007 [US1] เพิ่ม `asyncio.Lock` ที่ module level ใน `app.py` สำหรับบังคับ sequential OCR processing (FR-008)
- [x] T008 [US1] แก้ไข `process_ocr()` ใน `app.py` — ครอบด้วย `async with ocr_lock:` ก่อนเริ่ม processing
- [x] T009 [US1] แก้ไข `process_ocr()` ใน `app.py` — เรียก `check_and_unload_if_changed(system_prompt)` ก่อนเรียก Ollama inference (ระหว่าง prepare_ocr_messages และ POST /v1/chat/completions)
- [x] T010 [US1] เพิ่ม logging ใน `app.py` — log เหตุผลการ unload ตามรูปแบบ "systemPrompt changed (hash_a1b2 → hash_c3d4) — forcing model unload" (FR-005, SC-004)

**Checkpoint**: User Story 1 ทำงานได้ — prompt เปลี่ยน → unload + reload → ใช้ prompt ใหม่

---

## Phase 4: User Story 2 - ระบบตรวจจับการเปลี่ยน prompt อัตโนมัติ (Priority: P2)

**Goal**: หาก prompt ไม่เปลี่ยน → ไม่ unload (ใช้ KV cache ต่อไป) หากเปลี่ยน → unload + reload อัตโนมัติ

**Independent Test**: ส่ง OCR 2 ครั้งด้วย prompt เดียวกัน → ไม่มี cold start → เปลี่ยน prompt → ส่ง OCR → มี unload + reload

### Implementation for User Story 2

- [x] T011 [US2] ตรวจสอบ `check_and_unload_if_changed()` ใน `services/prompt_cache.py` — กรณี hash เหมือนเดิม → skip unload และ log "prompt unchanged (hash_xxxx) — skipping unload" (FR-003)
- [x] T012 [US2] ตรวจสอบ `check_and_unload_if_changed()` ใน `services/prompt_cache.py` — กรณี Redis ไม่มี hash (first request หลัง restart) → skip unload และ log "no cached prompt hash — first request, skipping unload" (FR-003, Edge Case: sidecar restart)
- [x] T013 [US2] เพิ่ม edge case handling ใน `services/prompt_cache.py` — กรณี systemPrompt=None: hash เป็น "none" และเปรียบเทียบเหมือน prompt ปกติ (FR-007, Edge Case: None → A และ None → None)

**Checkpoint**: User Story 2 ทำงานได้ — hot path ไม่ unload, cold path unload เฉพาะเมื่อ prompt เปลี่ยน

---

## Phase 5: User Story 3 - รองรับการย้าย Server ใหม่ RTX 5060 Ti 16GB (Priority: P3)

**Goal**: ระบบทำงานถูกต้องเมื่อ keep_alive > 0 บน New Server ที่มี VRAM 16GB

**Independent Test**: จำลอง keep_alive = 120 → เปลี่ยน prompt → ส่ง OCR → ตรวจสอบว่า unload + reload อัตโนมัติ

### Implementation for User Story 3

- [x] T014 [US3] ตรวจสอบว่า `check_and_unload_if_changed()` ใน `services/prompt_cache.py` ทำงานถูกต้องเมื่อ `residency.keep_alive_seconds > 0` — unload request ต้องส่ง `keep_alive=0` เสมอ (ไม่ใช่ค่าจาก residency policy)
- [x] T015 [US3] เพิ่ม log ใน `app.py` — log residency decision ควบคู่กับ prompt hash comparison เพื่อ debug บน New Server ("keep_alive=120s, prompt_hash=a1b2, cached_hash=a1b2 → skip unload")

**Checkpoint**: User Story 3 ทำงานได้ — รองรับ keep_alive > 0 บน New Server

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: การปรับปรุงที่มีผลต่อทุก user story

- [x] T016 [P] เพิ่ม unit test สำหรับ `compute_prompt_hash()` ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_prompt_cache.py` — ทดสอบ None, empty string, normal string, unicode (Thai)
- [x] T017 [P] เพิ่ม unit test สำหรับ `check_and_unload_if_changed()` ใน `tests/test_prompt_cache.py` — ทดสอบ hash match, hash mismatch, Redis miss, Ollama unload failure fallback
- [x] T018 เพิ่ม edge case handling ใน `services/prompt_cache.py` — กรณี Ollama ล่มหรือรีสตาร์ทระหว่างประมวลผล: ล้าง Redis hash (`del ocr:prompt:hash:np-dms-ocr`) เพื่อบังคับ first-request behavior ใน retry ถัดไป (Edge Case: Ollama crash/restart)
- [x] T019 รัน quickstart.md validation — ทดสอบ Test 1 ถึง Test 4 ตาม `specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/quickstart.md`
- [x] T020 อัปเดต Change Log ใน `app.py` — เพิ่ม entry สำหรับ prompt cache invalidation feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001, T002) — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase (T003-T006)
  - US1 (Phase 3): Core implementation — แก้ `app.py`
  - US2 (Phase 4): Refine `prompt_cache.py` — ทำได้หลัง US1
  - US3 (Phase 5): Validation + logging — ทำได้หลัง US2
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational — เป็น MVP
- **User Story 2 (P2)**: Depends on US1 (ใช้ function เดียวกัน แต่เพิ่ม edge case handling)
- **User Story 3 (P3)**: Depends on US2 (ตรวจสอบ + log บน context ที่ US2 สร้าง)

### Parallel Opportunities

- T001, T002 สามารถทำพร้อมกันได้ (ต่างไฟล์)
- T003-T006 ทำตามลำดับ (same file, sequential logic)
- T016, T017 สามารถทำพร้อมกันได้ (ต่าง test function)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006)
3. Complete Phase 3: User Story 1 (T007-T010)
4. **STOP and VALIDATE**: ทดสอบ prompt change → unload → ใช้ prompt ใหม่
5. Deploy หากพร้อม

### Incremental Delivery

1. Setup + Foundational → prompt_cache module พร้อม
2. Add User Story 1 → ทดสอบ prompt change → MVP!
3. Add User Story 2 → ทดสอบ hot path + edge cases
4. Add User Story 3 → ทดสอบบน New Server config
5. Polish → tests + quickstart validation

---

## Notes

- การแก้ไขทั้งหมดอยู่ที่ sidecar (`app.py` + `services/prompt_cache.py`) ไม่ต้องแก้ Backend NestJS
- Redis key: `ocr:prompt:hash:np-dms-ocr` (ไม่มี TTL)
- Unload request: POST `/v1/chat/completions` พร้อม `messages=[]`, `keep_alive=0`
- asyncio.Lock: module-level ใน `app.py` ไม่ใช่ Redis distributed lock
- Edge case "multi-page PDF → ไม่ต้อง unload ระหว่างหน้า" จัดการโดย implicit: `check_and_unload_if_changed()` เรียกครั้งเดียวต่อ `process_ocr()` call ไม่ใช่ต่อหน้า
