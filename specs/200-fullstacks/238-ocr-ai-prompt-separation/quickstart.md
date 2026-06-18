# Quick Start: OCR & AI Extraction Prompt Management

**Feature**: 238-ocr-ai-prompt-separation
**Date**: 2026-06-17

## Prerequisites

- Docker & Docker Compose (สำหรับ sidecar)
- Node.js >= 24 และ pnpm >= 10.33 (ดู `package.json` → `packageManager: pnpm@10.33.0`)
- MariaDB 10.6+ (database มีอยู่แล้ว)
- Redis 7+ (มีอยู่แล้ว)

> **Package manager**: โปรเจกต์นี้ใช้ **pnpm workspace** เท่านั้น (ห้ามใช้ `npm`/`yarn`). ใช้ filter `--filter backend` และ `--filter lcbp3-frontend`. ใช้ `npx` ได้เฉพาะ binary ของ tooling เช่น `npx playwright` เท่านั้น

## Setup Steps

### 1. Database Schema Delta (ADR-009: แก้ SQL โดยตรง — ห้ามใช้ TypeORM migration)

> **หมายเหตุ**: คอลัมน์ `version` (optimistic locking) มีอยู่แล้วจาก delta `2026-06-15-fix-ai-prompts-columns.sql` และ `public_id`/`context_config` จาก `2026-06-06-add-ai-prompts-public-id.sql` ดังนั้นงานเหลือมีเพียง seed ค่า default ของ `ocr_system`

สร้าง delta ใหม่ที่ `specs/03-Data-and-Storage/deltas/` แล้ว apply ผ่าน DB/admin pipeline (deploy.sh ไม่รัน SQL deltas ให้อัตโนมัติ):

```sql
-- File: specs/03-Data-and-Storage/deltas/2026-06-17-seed-ocr-system-prompt.sql

-- (idempotent) เพิ่ม version column เผื่อ environment เก่าที่ยังไม่มี
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1;

-- Seed default OCR system prompt (ถ้ายังไม่มี active ของ type นี้)
-- หมายเหตุ: schema จริงใช้ created_by INT FK → users(user_id) ไม่ใช่ created_by_public_id
INSERT INTO ai_prompts (
    public_id, prompt_type, version_number, template,
    context_config, is_active, activated_at, created_by
)
SELECT
    UUID(),
    'ocr_system',
    1,
    'Extract all text from this PDF page accurately.',
    '{"temperature": 0.1, "topP": 0.6}',
    1,
    CURRENT_TIMESTAMP,
    (SELECT user_id FROM users WHERE username = 'superadmin' LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompts WHERE prompt_type = 'ocr_system' AND is_active = 1
);
```

### 2. Sidecar Deployment

```bash
# บน Admin Desktop (Desk-5439)
cd specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar

# แก้ไข app.py:
# 1. เพิ่ม systemPrompt parameter ใน /ocr-upload endpoint
# 2. เพิ่ม /embed endpoint สำหรับ RAG vector generation

# Rebuild และ restart
docker-compose down
docker-compose up --build -d

# Verify
http://localhost:8080/health  # ควรตอบ {"status": "ok", "engine": "np-dms-ocr", ...}
```

### 3. Backend Deployment

> ขยายโมดูลเดิม `backend/src/modules/ai/prompts/` (มี `ai-prompts.controller.ts`, `ai-prompts.service.ts`, `ai-prompts.entity.ts`, `dto/` อยู่แล้วจาก ADR-029) — **อย่าสร้างไฟล์ controller/service/entity ชุดใหม่ที่ map ตาราง `ai_prompts` ซ้ำ**

```bash
# จาก repo root — ใช้ pnpm workspace filter (ห้าม cd เข้าไป npm install)
pnpm install

# ไฟล์ที่ต้องแก้ไข/เพิ่ม (ภายในโมดูลเดิม)
# - src/modules/ai/prompts/ai-prompts.service.ts        (เพิ่ม validation 'ocr_system')
# - src/modules/ai/prompts/ai-prompts.controller.ts     (เพิ่ม route ถ้าจำเป็น)
# - src/modules/ai/services/sandbox-ocr-engine.service.ts (ส่ง systemPrompt ไป sidecar)

# ADR-009: ไม่มี TypeORM migration — apply SQL delta ผ่าน DB/admin pipeline แทน

# Build & start (workspace filter)
pnpm --filter backend build
pnpm --filter backend start:prod
```

### 4. Frontend Deployment

```bash
# จาก repo root — frontend workspace package name คือ 'lcbp3-frontend'
pnpm install

# Deploy new components
# - components/admin/ai/PromptManagementTabs.tsx
# - components/admin/ai/OcrPromptTab.tsx
# - components/admin/ai/AiExtractionPromptTab.tsx
# - components/admin/ai/PromptVersionHistory.tsx
# - components/admin/ai/SandboxStepIndicator.tsx    # 3-step pipeline UI
# - components/admin/ai/RagPrepResultPanel.tsx      # Vector preview
# - components/admin/ai/SandboxWorkflow.tsx         # Full workflow
# - lib/services/admin-ai-prompt.service.ts

# Build (workspace filter)
pnpm --filter lcbp3-frontend build

# Deploy to production (QNAP NAS) ผ่าน Gitea Actions ตาม ADR-015
```

## Verification

### 1. Backend API Test

> **หมายเหตุ**: route จริงของ controller คือ `@Controller('ai/prompts')` + global prefix `/api` → `/api/ai/prompts/:promptType`. `promptType` เป็น path param (ไม่ใช่ body/query) และ create/activate **ต้องมี header `Idempotency-Key`** (ไม่งั้นจะได้ 400)

```bash
# 1. List OCR prompt versions ของ type
curl -X GET http://localhost:3001/api/ai/prompts/ocr_system \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Create new OCR prompt version (promptType อยู่ใน URL, body มีแค่ template/contextConfig)
curl -X POST http://localhost:3001/api/ai/prompts/ocr_system \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "template": "Extract all Thai and English text from this document accurately.",
    "contextConfig": {"temperature": 0.1}
  }'

# 3. Activate prompt version (promptType + versionNumber อยู่ใน URL)
# หมายเหตุ: activate() ปัจจุบันใช้ pessimistic lock — ไม่รับ expectedVersion ใน body
curl -X POST http://localhost:3001/api/ai/prompts/ocr_system/1/activate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)"
```

### 2. Frontend UI Test

1. เข้า AI Admin Console → Prompt Management
2. ตรวจสอบมี 2 tabs: "OCR Prompt" และ "AI Extraction Prompt"
3. คลิก OCR Prompt tab → ควรเห็น editable text area พร้อม active prompt
4. แก้ไข prompt → Save New Version
5. ไปที่ Sandbox → Step 1 (OCR) → รัน OCR → ตรวจสอบว่าใช้ prompt ที่แก้ไข
6. Step 2 (AI Extract) → รัน extraction → ตรวจสอบ JSON output
7. Step 3 (RAG Prep) → รัน chunking → ตรวจสอบ chunk list + vector preview (5 ตัวแรก)

### 3. Sidecar Integration Test

> **หมายเหตุ**: sidecar ต้องส่ง header `X-API-Key` (ดู `get_api_key` ใน app.py). endpoint `/embed` **มีอยู่แล้ว** (เพิ่ม 2026-06-11). **ยืนยันแล้ว**: systemPrompt inject ได้จริงโดย append text item เข้า `messages[0]["content"]` (pattern เดียวกับ DMS-tags injection ที่ app.py ทำอยู่แล้ว) — **ไม่** insert `{"role":"system"}` แยก

```bash
# Test /ocr-upload ด้วย systemPrompt (Step 1)
curl -X POST http://localhost:8765/ocr-upload \
  -H "X-API-Key: $OCR_SIDECAR_API_KEY" \
  -F "file=@test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "systemPrompt=Extract all text accurately."

# Test /embed endpoint (มีอยู่แล้ว — Step 3 RAG Prep)
curl -X POST http://localhost:8765/embed \
  -H "X-API-Key: $OCR_SIDECAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "sample text for embedding"}'
```

## Troubleshooting

### Optimistic Locking Conflict (HTTP 409)

**Symptom**: "Prompt has been modified by another user"

**Fix**:
1. Refresh page เพื่อดึง current version
2. Apply การแก้ไขใหม่
3. Save again

### Sidecar Not Accepting systemPrompt

**Symptom**: OCR ใช้ default prompt แทน custom

**Checklist**:
- [ ] app.py `/ocr-upload` มี parameter `systemPrompt: Optional[str] = Form(default=None)`
- [ ] thread systemPrompt ผ่าน `_process_pdf_doc()` → `process_ocr(..., system_prompt=systemPrompt)`
- [ ] `process_ocr()` append `{"type": "text", "text": system_prompt}` เข้า `messages[0]["content"]` ถ้า system_prompt มีค่า (ไม่ insert role=system)
- [ ] Backend ส่ง form field ชื่อถูกต้อง (`systemPrompt` ไม่ใช่ `system_prompt`)

### Missing Active OCR Prompt

**Symptom**: OCR job ใช้ default แต่ไม่มี warning

**Checklist**:
- [ ] Database มี record ที่ `prompt_type='ocr_system' AND is_active=1`
- [ ] Seed delta ถูก apply ผ่าน DB/admin pipeline (deploy.sh ไม่ apply SQL ให้อัตโนมัติ)
- [ ] Backend query ถูกต้อง (check logs)

## Rollback Plan

หากเกิดปัญหาใน production:

1. **Backend**: Revert ไป commit ก่อน deploy แล้ว `pnpm --filter backend build`
2. **Frontend**: Revert ไป commit ก่อน deploy แล้ว `pnpm --filter lcbp3-frontend build`
3. **Sidecar**: Rollback docker image ไป version ก่อน
4. **Database**: seed delta เป็น additive (INSERT แบบ idempotent) — ถ้าต้องถอน ให้ลบ row `ocr_system` ที่ seed เข้าไป

## References

- ADR-029: Dynamic Prompt Management
- ADR-037: Unified Prompt Management UX/UI
- ADR-009: Database Migration Strategy (edit SQL directly)
- AGENTS.md: Coding standards and patterns
