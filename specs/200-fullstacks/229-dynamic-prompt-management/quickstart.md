# Quickstart: Dynamic Prompt Management for OCR Extraction

**Feature**: `229-dynamic-prompt-management`
**Date**: 2026-05-25

---

## Pre-requisites

- [ ] Backend running: `pnpm --filter backend dev` (port 3001)
- [ ] Frontend running: `pnpm --filter frontend dev` (port 3000)
- [ ] MariaDB running with SQL delta applied
- [ ] Redis running (for cache testing)
- [ ] Logged in as Superadmin (user with `system.manage_all` permission)

---

> **Prerequisites**: User seed (`pnpm --filter backend seed` or `ts-node run-seed.ts`) MUST run before applying this delta. The seed INSERT for `ai_prompts` references `users.username = 'superadmin'` — if the user table is empty, the INSERT will fail with a FK constraint error.

## Step 1: Apply SQL Delta

```sql
-- Run in MariaDB:
SOURCE specs/03-Data-and-Storage/deltas/2026-05-25-create-ai-prompts.sql;

-- Verify:
SELECT id, prompt_type, version_number, is_active, LEFT(template, 50) AS template_preview
FROM ai_prompts;
-- Expected: 1 row, version_number=1, is_active=1
```

---

## Step 2: Verify API Endpoint (List Versions)

```bash
# List all versions for ocr_extraction:
curl -X GET http://localhost:3001/api/ai/prompts/ocr_extraction \
  -H "Authorization: Bearer <superadmin_token>"

# Expected: { data: [{ promptType: 'ocr_extraction', versionNumber: 1, isActive: true, ... }] }
```

---

## Step 3: Create a New Prompt Version

```bash
curl -X POST http://localhost:3001/api/ai/prompts/ocr_extraction \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "Improved prompt for OCR extraction:\n{{ocr_text}}\nReturn JSON with documentNumber, subject, discipline, date, confidence, category, tags, summary."
  }'

# Expected: { data: { versionNumber: 2, isActive: false, ... } }
```

---

## Step 4: Activate New Version

```bash
curl -X POST http://localhost:3001/api/ai/prompts/ocr_extraction/2/activate \
  -H "Authorization: Bearer <superadmin_token>"

# Expected: { data: { versionNumber: 2, isActive: true, activatedAt: "...", ... } }

# Verify old version is now inactive:
curl -X GET http://localhost:3001/api/ai/prompts/ocr_extraction \
  -H "Authorization: Bearer <superadmin_token>"
# Expected: v1 isActive=false, v2 isActive=true
```

---

## Step 5: Test Validation (Missing Placeholder)

```bash
curl -X POST http://localhost:3001/api/ai/prompts/ocr_extraction \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "template": "This prompt has no placeholder" }'

# Expected: 400 Bad Request
# { message: "template ต้องมี {{ocr_text}} placeholder", userMessage: "กรุณาเพิ่ม {{ocr_text}} ใน template ก่อนบันทึก" }
```

---

## Step 6: Verify Redis Cache

```bash
# After GET or activate, check Redis:
redis-cli GET "ai:prompt:active:ocr_extraction"
# Expected: JSON string of active prompt

# After activate:
redis-cli TTL "ai:prompt:active:ocr_extraction"
# Expected: number between 1-60 (seconds remaining)
```

---

## Step 7: UI Verification

> **Sandbox polling mechanism**: "เริ่มทำ OCR Sandbox" enqueues a BullMQ job to the `ai-batch` queue via the existing sandbox trigger endpoint. The frontend polls the existing job-status endpoint (`GET /api/ai/jobs/:jobId/status`) until the job completes or fails — this is the **existing pattern**, no new polling endpoint is introduced by this feature.

1. Navigate to `/admin` → AI Admin Console → OCR Sandbox tab
2. Verify: Prompt Editor shows active version template in textarea
3. Verify: Version History panel shows v1 (inactive), v2 (active ✅)
4. Click "Load" on v1 → template should appear in textarea (v2 still active)
5. Upload a PDF → Click "เริ่มทำ OCR Sandbox" → wait for result (up to 120s — cold start allowed)
6. Verify: Result JSON appears with 8 fields; `test_result_json` and `last_tested_at` updated on v2

---

## Step 8: Delete Inactive Version

```bash
# Try to delete active version (should fail):
curl -X DELETE http://localhost:3001/api/ai/prompts/ocr_extraction/2 \
  -H "Authorization: Bearer <superadmin_token>"
# Expected: 400 Bad Request

# Delete inactive version (should succeed):
curl -X DELETE http://localhost:3001/api/ai/prompts/ocr_extraction/1 \
  -H "Authorization: Bearer <superadmin_token>"
# Expected: 204 No Content
```

---

## Acceptance Checklist

- [ ] SQL delta applied; seed data present (v1, is_active=1)
- [ ] GET returns all versions for prompt_type
- [ ] POST validates {{ocr_text}} placeholder
- [ ] POST creates new inactive version with auto-incremented version_number
- [ ] Activate deactivates old + activates new + invalidates Redis cache (single transaction)
- [ ] Cannot delete active version
- [ ] Can delete inactive version
- [ ] PATCH saves manual_note
- [ ] processSandboxExtract uses 120s timeout (no timeout on cold start)
- [ ] processMigrateDocument uses same resolvePrompt() — no hardcoded prompt
- [ ] UI: Prompt Editor + Version History rendered correctly
- [ ] UI: OCR Sandbox run shows result + auto-saves test_result_json
- [ ] audit_logs records: create, activate, delete events
