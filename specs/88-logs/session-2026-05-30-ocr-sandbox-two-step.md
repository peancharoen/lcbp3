# Session 10 — 2026-05-30 (OCR Sandbox Two-Step Flow)

## Summary

แยก OCR Sandbox เป็น 2 steps ตาม spec 231: Step 1 OCR-only → Step 2 AI Extraction เพื่อให้ admin ตรวจคุณภาพ OCR ก่อนทดสอบ AI prompt

## Backend Changes (B1-B5)

- **AiBatchJobType**: เพิ่ม `sandbox-ocr-only` และ `sandbox-ai-extract` job types
- **AiBatchProcessor**:
  - เพิ่ม `processSandboxOcrOnly()` — รัน OCR เท่านั้น, cache OCR text ใน Redis key `ai:sandbox:ocr:{idempotencyKey}` (TTL 3600s)
  - เพิ่ม `processSandboxAiExtract()` — ดึง OCR text จาก cache, resolve prompt version (active หรือ version ที่ระบุ), replace {{ocr_text}} และ {{master_data_context}}, run LLM
- **AiPromptsService**: เพิ่ม `findByVersion(promptType, versionNumber)` method สำหรับดึง prompt version ที่ระบุ
- **AiController**:
  - เพิ่ม `POST /ai/admin/sandbox/ocr` — Step 1 endpoint (รับ file multipart/form-data)
  - เพิ่ม `POST /ai/admin/sandbox/ai-extract` — Step 2 endpoint (รับ requestPublicId + optional promptVersion)
- **AiQueueService**: อัปเดต `enqueueSandboxJob()` รองรับ job types ใหม่และ extraPayload สำหรับส่ง promptVersion

## Frontend Changes (F1-F3)

- **adminAiService**: เพิ่ม `submitSandboxOcr(file)` และ `submitSandboxAiExtract(requestPublicId, promptVersion)` methods
- **OcrSandboxPromptManager.tsx**:
  - เพิ่ม states: `sandboxStep` ('ocr'|'ai'), `ocrResult` (requestPublicId, ocrText, ocrUsed), `selectedPromptVersion`
  - เพิ่ม handlers: `handleStep1Ocr()` (poll OCR result), `handleStep2AiExtract()` (poll AI result), `handleResetSandbox()`
  - Refactor UI: Step 1 (upload + Run OCR button) → Step 2 (prompt version dropdown + Run AI Extraction button + Reset button)
  - แสดง OCR Raw Text card หลัง Step 1 เสร็จ (สีน้ำเงิน, badge บอก PaddleOCR/Fast Path)
  - แสดง AI Extraction result หลัง Step 2 เสร็จ (สีเขียว, badge บอก promptVersionUsed)

## Schema Fix (ADR-009 + ADR-019)

- **Delta SQL**: สร้าง `2026-05-30-add-ai-prompts-publicId.sql` เพิ่ม `publicId CHAR(36) UNIQUE` column ใน `ai_prompts` table
- **Root Cause**: Entity มี `publicId` field แต่ DB table ไม่มี column นี้ → QueryFailedError: "Unknown column 'AiPrompt.publicId' in 'SELECT'"
- **Fix**: ใช้ CHAR(36) แทน UUID type (MariaDB compatible), generate UUID สำหรับ existing records ด้วย `UUID()` function

## Verification

- Backend TypeScript: ✅ ผ่าน (`npx tsc --noEmit`)
- Frontend TypeScript: ✅ ผ่าน (`npx tsc --noEmit`)
- ESLint: ✅ ผ่าน (แก้ unused `user` parameter ใน `submitSandboxAiExtract`)

## Data Flow

```
Step 1: Upload PDF → POST /ai/admin/sandbox/ocr
  ↓
  BullMQ: sandbox-ocr-only job
  ↓
  OCR Service → Cache OCR text (ai:sandbox:ocr:{id})
  ↓
  Frontend displays OCR Raw Text

Step 2: Select prompt version → POST /ai/admin/sandbox/ai-extract
  ↓
  BullMQ: sandbox-ai-extract job
  ↓
  Retrieve OCR text from cache (ai:sandbox:ocr:{id})
  ↓
  Replace {{ocr_text}} → LLM → JSON result
  ↓
  Frontend displays AI Extraction result
```

## Pending

- Run delta SQL `2026-05-30-add-ai-prompts-publicId.sql` ใน production database
- Restart backend service หลัง apply delta
- Test 2-step flow จริงใน production environment
