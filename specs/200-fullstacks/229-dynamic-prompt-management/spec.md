# Feature Specification: Dynamic Prompt Management for OCR Extraction

**Feature Branch**: `229-dynamic-prompt-management`
**Created**: 2026-05-25
**Status**: Draft
**ADR Reference**: [ADR-029](../../06-Decision-Records/ADR-029-dynamic-prompt-management.md)
**Input**: Dynamic, runtime-editable OCR extraction prompts shared by OCR Sandbox and Migration processor — replaces hardcoded prompts, adds versioning, timeout bug fix, Redis caching.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Prompt Version Management (Priority: P1)

Superadmin สามารถดูรายการ Prompt Versions ทั้งหมด, สร้าง Prompt Version ใหม่, activate version ที่ต้องการให้ระบบใช้จริง และลบ version ที่ไม่ต้องการ (ยกเว้น active version) ผ่าน AI Admin Console

**Why this priority**: นี่คือรากฐานของ feature ทั้งหมด — หากไม่มีโครงสร้างการจัดการ Prompt Version, ระบบยังคงใช้ prompt แบบ hardcoded และไม่สามารถแก้ไข runtime ได้

**Independent Test**: เปิด AI Admin Console → OCR Sandbox tab → จัดการ Prompt Versions ได้โดยไม่ต้อง upload PDF ใดๆ

**Acceptance Scenarios**:

1. **Given** มี Prompt Versions ใน DB, **When** superadmin เปิด OCR Sandbox tab, **Then** เห็น Version History panel ทางขวามือพร้อม active version ที่มีเครื่องหมาย ✅
2. **Given** superadmin กรอก Prompt Template ที่มี `{{ocr_text}}` placeholder, **When** กด "บันทึก Version ใหม่", **Then** สร้าง version ใหม่ (inactive) และปรากฏใน Version History
3. **Given** superadmin กรอก Prompt Template ที่ไม่มี `{{ocr_text}}`, **When** กด "บันทึก Version ใหม่", **Then** ระบบแสดง error "template ต้องมี {{ocr_text}} placeholder" และไม่บันทึก
4. **Given** มี inactive version, **When** superadmin กด "Activate", **Then** version นั้นกลายเป็น active, version เดิมกลายเป็น inactive, Redis cache ถูก invalidate ทันที
5. **Given** มี active version, **When** superadmin พยายามกด Delete บน active version, **Then** ระบบปฏิเสธพร้อมข้อความ "ไม่สามารถลบ active version ได้"
6. **Given** มี inactive version, **When** superadmin กด Delete, **Then** version ถูกลบออกจาก DB และหายจาก Version History
7. **Given** superadmin กด Load บน version ใดๆ, **When** version โหลด, **Then** template ของ version นั้นปรากฏใน Prompt Editor textarea (ไม่ activate อัตโนมัติ)

---

### User Story 2 - OCR Sandbox Testing with Prompt Evaluation (Priority: P2)

Superadmin สามารถ upload PDF และทดสอบ OCR + LLM extraction ด้วย Active Prompt ปัจจุบัน เพื่อประเมินคุณภาพผลลัพธ์ก่อนใช้งานจริงกับ Migration batch โดยผลลัพธ์ auto-save ลง active version และรองรับ Manual Note annotation

**Why this priority**: Sandbox testing ช่วยให้ admin ตรวจสอบและเปรียบเทียบ prompt ก่อน activate จริง — ลดความเสี่ยงที่ prompt ไม่ดีจะกระทบ Migration batch

**Independent Test**: upload PDF → กด "เริ่มทำ OCR Sandbox" → เห็นผล JSON ครบ 8 fields และผลลัพธ์ auto-save ลง active version

**Acceptance Scenarios**:

1. **Given** มี Active Prompt, **When** superadmin upload PDF และกด "เริ่มทำ OCR Sandbox", **Then** ระบบรัน OCR + LLM extraction ด้วย active prompt และแสดงผล JSON ที่มี 8 fields (documentNumber, subject, discipline, date, confidence, category, tags, summary)
2. **Given** sandbox run เสร็จสิ้น, **When** ผลลัพธ์ JSON ออกมา, **Then** ผลลัพธ์ auto-save ลงใน active version's `test_result_json` และ update `last_tested_at` อัตโนมัติ
3. **Given** ผลลัพธ์ sandbox ปรากฏ, **When** superadmin พิมพ์ manual note และกด "บันทึก Manual Note", **Then** note ถูกบันทึกลงใน `manual_note` field ของ active version
4. **Given** OCR Sandbox ถูก trigger และ Ollama ต้องโหลด model ใหม่ (cold start), **When** ระบบรอผล, **Then** ระบบรอได้นานถึง 120 วินาที ไม่ timeout ก่อนกำหนด (แก้ bug จาก AI_TIMEOUT_MS = 30s)
5. **Given** ไม่มี Active Prompt, **When** superadmin กด "เริ่มทำ OCR Sandbox", **Then** ระบบแสดง error ว่าไม่พบ active prompt และไม่รัน sandbox

---

### User Story 3 - Runtime Prompt Resolution (Priority: P3)

ระบบ (processor layer) สามารถดึง Active Prompt จาก `ai_prompts` table ผ่าน Redis cache (TTL 60s) และใช้ใน `processSandboxExtract` กับ `processMigrateDocument` ได้โดยทั้งสองใช้ prompt เดียวกัน — ไม่มี hardcoded prompt ใน codebase

**Why this priority**: Backend plumbing ที่ทำให้ US1 และ US2 มีผลจริงในระบบ Production — ถ้าไม่มี US3, prompt ที่ admin set ผ่าน UI ไม่มีผลต่อ processor

**Independent Test**: activate prompt version ใหม่ → trigger sandbox job → ตรวจสอบ log ว่า job ใช้ prompt version ใหม่

**Acceptance Scenarios**:

1. **Given** มี Active Prompt ใน DB, **When** processor เรียก `resolvePrompt('ocr_extraction', ocrText)`, **Then** ได้รับ resolved prompt ที่แทนที่ `{{ocr_text}}` ด้วย OCR text จริง
2. **Given** Active Prompt ถูก cache ใน Redis TTL 60s, **When** processor เรียก `resolvePrompt()` ภายใน 60s, **Then** ได้รับ prompt จาก Redis cache (ไม่ query DB ซ้ำ)
3. **Given** admin activate version ใหม่ (cache invalidated), **When** processor เรียก `resolvePrompt()` ครั้งถัดไป, **Then** ได้รับ prompt version ล่าสุดจาก DB และ cache ถูก refresh
4. **Given** ไม่มี Active Prompt ใน DB (เช่น deploy ใหม่ก่อน seed), **When** processor พยายาม `resolveActive()`, **Then** `BusinessException` throw → BullMQ mark job **failed** → `migrationService.createError()` บันทึก error → batch หยุด (fail-fast — ไม่ใช้ skip เพราะทำให้เกิด silent data gap)

---

### Edge Cases

- อะไรเกิดขึ้นถ้า admin สองคน activate พร้อมกัน? → `activate()` ต้องใช้ `SELECT ... FOR UPDATE` เพื่อ lock current active row ก่อน deactivate — serializes concurrent activations ต่อ `prompt_type`; admin คนที่สองจะ block จนกว่าคนแรก COMMIT — ไม่มี double-active
- อะไรเกิดขึ้นถ้า admin activate version ขณะที่ Migration batch กำลังรัน? → job ที่กำลัง run ใช้ prompt ที่ดึงมาแล้ว (per-job resolution); job ถัดไปจะใช้ prompt ใหม่ — acceptable tradeoff
- อะไรเกิดขึ้นถ้า Redis ล่มขณะที่ processor เรียก `resolvePrompt()`? → fallback query DB โดยตรง; ระบบยังทำงานได้ แต่ performance ลด
- อะไรเกิดขึ้นถ้า template ยาวเกิน 4,000 ตัวอักษร? → `create()` reject ด้วย `ValidationException('Template exceeds 4,000 character limit')` — ป้องกัน context window overflow ใน Ollama (FR-015)
- อะไรเกิดขึ้นถ้า PDF ที่ upload ใน sandbox ไม่มี text (scanned image)? → OCR Service รัน PaddleOCR ตาม existing flow; ไม่ใช่ scope ของ feature นี้
- อะไรเกิดขึ้นถ้า Ollama timeout แม้จะตั้ง 120s? → sandbox job fail พร้อม error message; ไม่กระทบ Migration jobs อื่น
- อะไรเกิดขึ้นถ้า version 1 (seed data) ถูกลบก่อนที่จะมี version อื่น active? → ป้องกันได้ด้วย guard "ห้ามลบ active version"
- อะไรเกิดขึ้นถ้าผลลัพธ์ JSON จาก sandbox ไม่ครบ 8 fields? → save ทุกอย่างที่ได้ใน `test_result_json`, UI แสดงตามที่มี
- อะไรเกิดขึ้นถ้า admin ลบ v2 แล้วสร้าง version ใหม่ → version number กลายเป็น v4 ข้าม v2? → by design (monotonically increasing, ไม่ fill gaps per plan.md D6); UI MUST แสดง version numbers ตามที่เป็น ไม่ reindex — ป้องกัน admin สับสน "v2 หายไปไหน?"
- อะไรเกิดขึ้นถ้า processor crash หลัง Ollama return แต่ก่อน `saveTestResult()` รัน? → `test_result_json` ยังเป็น `NULL` (เหมือนยังไม่ทดสอบ) — acceptable; admin รัน sandbox ใหม่ได้ทันที; ไม่กระทบ Active Prompt หรือ migration batch

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST บันทึก Prompt Template เป็น versioned records ใน `ai_prompts` table — ทุกการบันทึกสร้าง version ใหม่เสมอ (immutable; ไม่มี update template เดิม)
- **FR-002**: ระบบ MUST validate ว่า template มี `{{ocr_text}}` placeholder ก่อน save — reject พร้อม user-friendly error message ถ้าไม่มี
- **FR-003**: ระบบ MUST enforce single active version ต่อ `prompt_type` — activate version ใหม่จะ deactivate version เดิมอัตโนมัติใน transaction เดียว
- **FR-004**: ระบบ MUST ห้ามลบ active version — แสดง error ถ้าพยายามลบ active version
- **FR-005**: ระบบ MUST auto-save `test_result_json` และ update `last_tested_at` ลงใน Prompt Version ที่ **active ณ เวลาที่ job เริ่มทำงาน** (ไม่ใช่เวลาที่ result กลับมา) — กัน race condition ที่ admin activate version อื่นระหว่างที่ sandbox กำลังรันอยู่
- **FR-006**: ระบบ MUST รองรับ `manual_note` annotation จาก admin ต่อ Prompt Version ผ่าน PATCH endpoint
- **FR-007**: ระบบ MUST invalidate Redis cache (`ai:prompt:active:ocr_extraction`) ทันทีหลัง activate สำเร็จ
- **FR-008**: `processSandboxExtract` MUST ใช้ timeout 120000ms เพื่อรองรับ Ollama cold start (แก้ bug AI_TIMEOUT_MS = 30000ms)
- **FR-009**: ทั้ง `processSandboxExtract` และ `processMigrateDocument` MUST ใช้ `resolvePrompt()` method เดียวกัน — ไม่มี hardcoded prompt ใน processor
- **FR-010**: API endpoints ทั้งหมดสำหรับ Prompt Management MUST ป้องกันด้วย `system.manage_all` CASL permission
- **FR-011**: ระบบ MUST มี seed data (Prompt Version 1 ที่ migrate จาก hardcoded prompt ปัจจุบัน พร้อม `is_active = 1`) ก่อน deploy
- **FR-012**: Redis cache MUST fallback ไป DB query ถ้า Redis ไม่พร้อมใช้งาน (graceful degradation)
- **FR-013**: Prompt activation, creation, deletion events MUST be recorded in standard `audit_logs` table (ไม่ใช่ `ai_audit_logs`)
- **FR-014**: `GET /ai/prompts/:type` MUST return all versions สำหรับ prompt_type นั้น (ไม่ paginate ใน v1)
- **FR-015**: `template` MUST NOT exceed **4,000 characters** — รักษา headroom ใน context window 8192 tokens ของ gemma4:e4b เพื่อให้ OCR text มีที่เหลือ — reject พร้อม user-friendly error ถ้าเกิน

### Key Entities

- **Prompt Version** (`ai_prompts`): Immutable snapshot ของ prompt template — มี `prompt_type`, `version_number`, `template`, `is_active`, `test_result_json`, `manual_note`, `last_tested_at`, `activated_at`, `created_by`
- **Active Prompt**: Prompt Version ที่ `is_active = 1` ต่อ `prompt_type` — cached ใน Redis key `ai:prompt:active:{prompt_type}` TTL 60s
- **Prompt Template**: String ที่มี `{{ocr_text}}` placeholder บังคับ — resolved เป็น final prompt โดย processor ก่อนส่งเข้า Ollama

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Superadmin สามารถสร้าง, activate, และลบ Prompt Version ได้ภายใน 30 วินาที ต่อการดำเนินการหนึ่งครั้ง
- **SC-002**: OCR Sandbox รันได้สำเร็จสำหรับ PDF ที่ถูก upload โดยไม่ timeout ก่อน 120 วินาที
- **SC-003**: Processor ดึง Active Prompt จาก Redis cache ภายใน 5ms ในช่วง TTL 60s (ไม่ query DB ซ้ำ)
- **SC-004**: หลัง activate Prompt Version ใหม่, jobs ถัดไปทั้งหมดใช้ prompt version ใหม่ภายใน 60 วินาที (Redis TTL expiry)
- **SC-005**: ไม่มี hardcoded prompt template ใน codebase หลังจาก feature นี้ deploy — 100% DB-driven
- **SC-006**: Version History แสดง Prompt Versions ทั้งหมดพร้อม status (active/inactive) และ last_tested_at ได้อย่างถูกต้อง

---

## Clarifications

### Session 2026-05-25

- Q: Should prompt activation and sandbox run events be recorded in `ai_audit_logs` or standard `audit_logs`? → A: Standard `audit_logs` — these are admin config actions, not AI inference results; keeps `AiPromptsModule` decoupled from `AiAuditLogModule`
- Q: Should `GET /ai/prompts/:type` use pagination? → A: Return all versions (no pagination in v1) — prompt versions are expected to be low-count (single digits to low tens); simplifies UI implementation

---

## Assumptions

- Scope จำกัดที่ `prompt_type = 'ocr_extraction'` เดียว (8 fields: documentNumber, subject, discipline, date, confidence, category, tags, summary) ตาม ADR-029 core decisions
- Admin ที่ใช้ feature นี้คือ Superadmin ที่มี `system.manage_all` permission เท่านั้น
- OCR Service (PaddleOCR sidecar บน Desk-5439) ยังคงทำงานเหมือนเดิม — feature นี้เปลี่ยนเฉพาะ LLM prompt หลัง OCR
- Seed data (version 1 ที่ migrate จาก hardcoded prompt) ต้องถูก insert ก่อน first deploy ผ่าน SQL delta (ADR-009)
- Redis พร้อมใช้งาน; ถ้า Redis ล่ม ระบบ graceful degrade ไป DB query
- Existing `AiController` / `AiModule` สามารถ extend ได้โดยไม่ต้อง refactor โครงสร้างหลัก
- `field_schema JSON NULL` column ใน `ai_prompts` เป็น system-managed metadata (ไม่ user-editable ใน v1) — ระบุ expected output fields สำหรับ validation
- Timeout fix ใช้กับ `processSandboxExtract` เท่านั้น; `processMigrateDocument` ใช้ default timeout ของ BullMQ job (queue-level timeout ต่างกัน)
