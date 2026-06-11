// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/quickstart.md
// Change Log:
// - 2026-06-11: Verification quickstart for AI Runtime Policy Refactor

# Quickstart: AI Runtime Policy Refactor — Verification Guide

## Prerequisites

- Backend running (`pnpm run start:dev` in `backend/`)
- OCR sidecar running on Desk-5439 (`docker compose up` in ocr-sidecar/)
- Ollama running with `np-dms-ai` and `np-dms-ocr` tags registered
- Admin user token available

---

## Gate 1: Policy Contract Verification

### 1A. Reject model.key (should return 400)

```bash
curl -X POST http://localhost:3001/api/ai/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "model": {"key": "typhoon2.5-np-dms:latest"}}' \
  | jq '.statusCode, .message'
# Expected: 400, message about model.key not allowed
```

### 1B. Reject parameter overrides (should return 400)

```bash
curl -X POST http://localhost:3001/api/ai/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "temperature": 0.9}' \
  | jq '.statusCode'
# Expected: 400
```

### 1C. Valid executionProfile (should return 201)

```bash
curl -X POST http://localhost:3001/api/ai/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "executionProfile": "balanced", "documentPublicId": "<uuid>"}' \
  | jq '.data.modelUsed'
# Expected: "np-dms-ai"
```

### 1D. large-context by non-admin (should return 403)

```bash
curl -X POST http://localhost:3001/api/ai/jobs \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "executionProfile": "large-context"}' \
  | jq '.statusCode'
# Expected: 403
```

---

## Gate 2: Canonical Naming Verification

### 2A. Check audit log after job

```sql
SELECT metadata->>'$.modelUsed' FROM ai_audit_logs ORDER BY created_at DESC LIMIT 1;
-- Expected: "np-dms-ai" (ไม่ใช่ "typhoon2.5-np-dms:latest")
```

### 2B. Check Admin Console (Manual)

1. เปิด `/admin/ai` ใน browser
2. ตรวจว่า model labels ทั้งหมดแสดง `np-dms-ai` และ `np-dms-ocr`
3. ตรวจว่าไม่มี `typhoon*` ปรากฏใน UI

---

## Gate 3: Adaptive OCR Residency Verification

### 3A. OCR under large-context profile

```bash
# ส่ง OCR job ขณะที่มี large-context job active
# ดู sidecar log
docker logs ocr-sidecar --tail 20
# Expected log line: keep_alive=0 reason=large-context-active
```

### 3B. OCR with headroom sufficient

```bash
# ส่ง OCR job เมื่อ GPU headroom สูง (ไม่มี model loaded หนัก)
docker logs ocr-sidecar --tail 20
# Expected log line: keep_alive=120 reason=headroom-sufficient
```

---

## Gate 4: Retrieval CPU Fallback Verification

### 4A. Force GPU pressure then run RAG

```bash
# 1. Force load large model
curl http://localhost:11434/api/generate -d '{"model":"np-dms-ai","prompt":"warmup","keep_alive":-1}'

# 2. Run RAG query
curl -X POST http://localhost:3001/api/ai/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"rag-query","executionProfile":"balanced","documentPublicId":"<uuid>"}' \
  | jq '.data.status'
# Expected: "completed" (ไม่ fail)

# 3. ตรวจ sidecar log
docker logs ocr-sidecar --tail 20
# Expected: device=cpu reason=gpu-headroom-below-threshold
```

---

## Automated Test Suite

```bash
# Backend unit + integration tests
cd backend
pnpm test -- --testPathPattern="ai-policy|ocr-residency|execution-profile"

# Sidecar tests
cd specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar
pytest tests/ -v
```

**All tests must pass** before cutover gate is considered complete.
