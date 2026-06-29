// File: specs/200-fullstacks/236-unified-ocr-architecture/quickstart.md
// Change Log:
// - 2026-06-13: Verification quickstart for Unified AI Model Architecture — Sandbox-Production Parity

# Quickstart: Unified AI Model Architecture — Verification Guide

## Prerequisites

- Backend running (`pnpm run start:dev` in `backend/`)
- Admin user token with `system.manage_ai` permission
- SQL delta applied: `specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql`
- OCR sidecar running on Desk-5439 (for OCR-related tests)

## Environment Setup

| Environment | Backend URL | ใช้เมื่อ |
|-------------|-------------|----------|
| **Production (QNAP + NPM)** | `https://backend.np-dms.work/api` | ทดสอบจากภายนอก |
| **Local dev** | `http://localhost:3001` | รัน backend บนเครื่องตัวเอง |

### Bash

```bash
export BACKEND_URL="https://backend.np-dms.work/api"
export TOKEN="your-jwt-token-here"
export IDEMPOTENCY_KEY="test-$(date +%s)"
```

### PowerShell

```powershell
$env:BACKEND_URL = "https://backend.np-dms.work/api"
$env:TOKEN = "your-jwt-token-here"
$env:IDEMPOTENCY_KEY = "test-$(Get-Date -UFormat %s)"
```

---

## Gate 1: Sandbox Parameter Testing (US1)

### 1A. Get sandbox draft (should auto-seed from production if absent)

**Bash:**
```bash
curl -s "$BACKEND_URL/ai/sandbox-profiles/standard" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print(d.get('profileName'), d.get('temperature'))"
# Expected: "standard" 0.5 (or current production value)
```

**PowerShell:**
```powershell
(Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/sandbox-profiles/standard" -Headers @{
  "Authorization" = "Bearer $env:TOKEN"
}).data | Select-Object profileName, temperature
# Expected: profileName=standard, temperature=0.5
```

### 1B. Save sandbox draft (should not affect production)

**Bash:**
```bash
curl -s -X PUT "$BACKEND_URL/ai/sandbox-profiles/standard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY-save" \
  -d '{"temperature": 0.8, "topP": 0.9, "repeatPenalty": 1.15, "keepAliveSeconds": 300}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('temperature'))"
# Expected: 0.8
```

### 1C. Verify production unchanged after sandbox save

```bash
curl -s "$BACKEND_URL/ai/profiles/standard" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print('production temperature:', d.get('temperature'))"
# Expected: original production value (not 0.8)
```

### 1D. Reset sandbox to production values

**Bash:**
```bash
curl -s -X POST "$BACKEND_URL/ai/sandbox-profiles/standard/reset" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('temperature'))"
# Expected: original production temperature (e.g. 0.5)
```

---

## Gate 2: Apply to Production (US2)

### 2A. Apply with valid Idempotency-Key (should succeed)

**Bash:**
```bash
APPLY_KEY="apply-standard-$(date +%s)"
curl -s -X POST "$BACKEND_URL/ai/profiles/standard/apply" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $APPLY_KEY" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('appliedAt'), d.get('data', {}).get('cacheInvalidated'))"
# Expected: ISO timestamp, True
```

**PowerShell:**
```powershell
$applyKey = "apply-standard-$(Get-Date -UFormat %s)"
(Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/profiles/standard/apply" -Method POST -Headers @{
  "Authorization"  = "Bearer $env:TOKEN"
  "Content-Type"   = "application/json"
  "Idempotency-Key" = $applyKey
}).data | Select-Object appliedAt, cacheInvalidated
# Expected: appliedAt = ISO timestamp, cacheInvalidated = True
```

### 2B. Duplicate apply with same Idempotency-Key (should return cached result)

```bash
# Run same apply again with same key — should return 200 with cached result, not re-apply
curl -s -X POST "$BACKEND_URL/ai/profiles/standard/apply" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $APPLY_KEY" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print('idempotent:', 'appliedAt' in d.get('data', {}))"
# Expected: idempotent: True
```

### 2C. Apply with invalid temperature (should return 400)

```bash
curl -s -X PUT "$BACKEND_URL/ai/sandbox-profiles/standard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temperature": 1.5, "topP": 0.9, "repeatPenalty": 1.1, "keepAliveSeconds": 300}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', {}).get('statusCode'))"
# Expected: 400
```

### 2D. Verify audit log created

```sql
SELECT
  action, metadata->>'$.profileName', metadata->>'$.newValues',
  created_at
FROM ai_audit_logs
WHERE action = 'APPLY_PROFILE'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: action='APPLY_PROFILE', profileName='standard', newValues with applied params
```

---

## Gate 3: Dual-Model Parameter Management (US3)

### 3A. Get OCR sandbox profile (ocr-extract row)

```bash
curl -s "$BACKEND_URL/ai/sandbox-profiles/ocr-extract" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print(d.get('canonicalModel'), d.get('numCtx'), d.get('maxTokens'))"
# Expected: "np-dms-ocr" None None  (numCtx/maxTokens null for OCR)
```

### 3B. Verify np-dms-ai and np-dms-ocr are independent

```sql
-- ตรวจสอบว่ามี 2 rows ที่แยกกันใน ai_execution_profiles
SELECT profile_name, canonical_model, temperature, num_ctx, max_tokens
FROM ai_execution_profiles
WHERE profile_name IN ('standard', 'ocr-extract');
-- Expected: standard → np-dms-ai (num_ctx populated), ocr-extract → np-dms-ocr (num_ctx NULL)
```

---

## Gate 4: Master Data Context Parity (US4)

### 4A. Sandbox test requires project selection

```bash
# ส่ง sandbox test โดยไม่ระบุ projectPublicId — ควร return 400
curl -s -X POST "$BACKEND_URL/ai/sandbox/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filePublicId": "<uuid>"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', {}).get('statusCode'))"
# Expected: 400
```

### 4B. Sandbox test with real project context

```bash
# สมมติว่ามี projectPublicId จริง
curl -s -X POST "$BACKEND_URL/ai/sandbox/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filePublicId": "<file-uuid>", "projectPublicId": "<project-uuid>"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('status'))"
# Expected: "processing" or "completed"
```

---

## Gate 5: System Prompt Integration (US5)

### 5A. Verify apply endpoint does not touch ai_prompts

```sql
-- Apply parameter → ตรวจว่า ai_prompts ไม่ถูกแตะต้อง
-- Run before apply:
SELECT updated_at FROM ai_prompts WHERE prompt_type = 'ocr_extraction' ORDER BY updated_at DESC LIMIT 1;
-- Apply parameters via API...
-- Run after apply — timestamp should be unchanged:
SELECT updated_at FROM ai_prompts WHERE prompt_type = 'ocr_extraction' ORDER BY updated_at DESC LIMIT 1;
```

---

## Automated Test Suite

```bash
# Backend unit tests (sandbox + apply + dual-model)
cd backend
pnpm test -- --testPathPattern="ai-policy.service"

# Backend unit tests (processor dual-model snapshot)
pnpm test -- --testPathPattern="ai-batch.processor"

# Backend unit tests (OCR parameter wiring)
pnpm test -- --testPathPattern="ocr.service"

# Backend integration tests (apply flow end-to-end)
pnpm test -- --testPathPattern="ai-policy.service.integration"

# Run all AI-related tests
pnpm test -- --testPathPattern="(ai-policy|ai-batch|ocr.service)"
```

**All tests must pass** before deployment.

---

## Model Name Verification

```bash
# ตรวจสอบว่าไม่มี typhoon* ใน codebase (ควรเป็น 0)
grep -r "typhoon2\.5-np-dms\|typhoon-np-dms-ocr" backend/src/ frontend/ --include="*.ts" --include="*.tsx" | wc -l
# Expected: 0
```
