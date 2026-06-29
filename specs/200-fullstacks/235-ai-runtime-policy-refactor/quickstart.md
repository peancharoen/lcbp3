// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/quickstart.md
// Change Log:
// - 2026-06-11: Verification quickstart for AI Runtime Policy Refactor
// - 2026-06-12: เพิ่ม PowerShell syntax และ environment variable setup

# Quickstart: AI Runtime Policy Refactor — Verification Guide

## Prerequisites

- Backend running (`pnpm run start:dev` in `backend/`)
- OCR sidecar running on Desk-5439 (`docker compose up` in ocr-sidecar/)
- Ollama running with `np-dms-ai` and `np-dms-ocr` tags registered
- Admin user token available

## Environment Setup

### การเข้าถึง Backend (สำคัญ)

จาก `@/specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml`:

| Environment | Backend URL | ใช้เมื่อ |
|-------------|-------------|----------|
| **Production (QNAP + NPM)** | `https://backend.np-dms.work/api` | ทดสอบจากเครื่องภายนอก (WSL, บ้าน) |
| **QNAP Internal** | `http://backend:3000` | ทดสอบจากภายใน QNAP (docker network) |
| **Local dev** | `http://localhost:3001` | รัน backend บนเครื่องตัวเอง |

**หมายเหตุ:** Backend container ใช้ port **3000** (ไม่ใช่ 3001) และอยู่ behind nginx proxy manager

### Bash (Linux/macOS/Git Bash on Windows)

```bash
# สำหรับ Production QNAP (ผ่าน HTTPS + NPM)
export BACKEND_URL="https://backend.np-dms.work/api"

# หรือถ้า SSH tunnel ไป QNAP แล้ว
# export BACKEND_URL="http://localhost:3000"

export TOKEN="your-jwt-token-here"
```

### PowerShell (Windows)

```powershell
# สำหรับ Production QNAP (ผ่าน HTTPS + NPM)
$env:BACKEND_URL = "https://backend.np-dms.work/api"

# หรือถ้า SSH tunnel ไป QNAP แล้ว
# $env:BACKEND_URL = "http://localhost:3000"

$env:TOKEN = "your-jwt-token-here"
```

---

### วิธีหา TOKEN

**วิธีที่ 1: Login ผ่าน API (Bash)**

```bash
# Login แล้วดึง token จาก response
# หมายเหตุ: Backend ใช้ 'username' (ไม่ใช่ email) ใน login field
RESPONSE=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Center2025"}')

# วิธีดึง TOKEN (เลือก 1 จาก 3):

# วิธี 1: ใช้ jq (ถ้าติดตั้งแล้ว)
# export TOKEN=$(echo $RESPONSE | jq -r '.access_token')

# วิธี 2: ใช้ Python (ทั่วไปมีอยู่แล้ว) — แนะนำ
export TOKEN=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['access_token'])")

# วิธี 3: ดู response แล้ว copy เอง (ถ้าไม่มีทั้ง jq และ Python)
# echo $RESPONSE
# export TOKEN="paste_token_here"
```

**วิธีที่ 2: ดึงจาก Browser DevTools**

1. เปิด browser ไปที่ `http://192.168.10.8:3000` (frontend)
2. Login ด้วย account ที่มีสิทธิ์ admin
3. กด F12 → Network tab
4. รีเฟรชหน้า หรือ ทำ action ใดก็ได้
5. ดู request ที่ส่งไป backend → Headers → `Authorization: Bearer eyJhbG...`
6. Copy ค่าหลัง `Bearer ` มาใส่ใน `$TOKEN`

**วิธีที่ 3: ถ้ามี Access ตรงกับ Database**

```sql
-- ดู username ที่มี role = 'admin' (หลังจากนั้นต้อง login ผ่าน API เพื่อเอา token)
SELECT username FROM users WHERE role = 'admin' LIMIT 1;
```

---

### Default Users (จาก Seed Data)

ถ้าใช้ seed data เริ่มต้น มี users นี้ให้ใช้:

| Username | Role | Password |
|----------|------|----------|
| `superadmin` | Superadmin | `Center2025` |
| `admin` | Org Admin | `Center2025` |
| `editor01` | Editor | `Center2025` |
| `viewer01` | Viewer | `Center2025` |

---

## Gate 1: Policy Contract Verification

### 1A. Reject model.key (should return 400)

**Bash:**
```bash
curl -X POST "$BACKEND_URL/ai/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "model": {"key": "typhoon2.5-np-dms:latest"}}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); e=d.get('error', {}); print(e.get('statusCode'), e.get('message'))"
# Expected: 400, message about model.key not allowed
```

**PowerShell:**
```powershell
$body = '{"type": "rag-query", "model": {"key": "typhoon2.5-np-dms:latest"}}'
Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/jobs" -Method POST -Headers @{
    "Authorization" = "Bearer $env:TOKEN"
    "Content-Type" = "application/json"
} -Body $body | Select-Object statusCode, message
# Expected: 400, message about model.key not allowed
```

### 1B. Reject parameter overrides (should return 400)

**Bash:**
```bash
curl -X POST "$BACKEND_URL/ai/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "temperature": 0.9}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', {}).get('statusCode'))"
# Expected: 400
```

**PowerShell:**
```powershell
$body = '{"type": "rag-query", "temperature": 0.9}'
(Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/jobs" -Method POST -Headers @{
    "Authorization" = "Bearer $env:TOKEN"
    "Content-Type" = "application/json"
} -Body $body).statusCode
# Expected: 400
```

### 1C. Valid executionProfile (should return 201)

**Bash:**
```bash
curl -X POST "$BACKEND_URL/ai/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "executionProfile": "balanced", "documentPublicId": "<uuid-here>"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('modelUsed'))"
# Expected: "np-dms-ai"
```

**PowerShell:**
```powershell
$body = '{"type": "rag-query", "executionProfile": "balanced", "documentPublicId": "<uuid-here>"}'
(Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/jobs" -Method POST -Headers @{
    "Authorization" = "Bearer $env:TOKEN"
    "Content-Type" = "application/json"
} -Body $body).data.modelUsed
# Expected: "np-dms-ai"
```

### 1D. large-context by non-admin (should return 403)

**Bash:**
```bash
curl -X POST "$BACKEND_URL/ai/jobs" \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "rag-query", "executionProfile": "large-context"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', {}).get('statusCode'))"
# Expected: 403
```

**PowerShell:**
```powershell
$body = '{"type": "rag-query", "executionProfile": "large-context"}'
(Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/jobs" -Method POST -Headers @{
    "Authorization" = "Bearer $env:NON_ADMIN_TOKEN"
    "Content-Type" = "application/json"
} -Body $body).statusCode
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

**Step 1: Force load large model (Bash)**
```bash
# ถ้า Ollama รันบน Desk-5439 (192.168.10.100)
curl http://192.168.10.100:11434/api/generate -d '{"model":"np-dms-ai","prompt":"warmup","keep_alive":-1}'
```

**Step 2: Run RAG query**

*Bash:*
```bash
curl -X POST "$BACKEND_URL/ai/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"rag-query","executionProfile":"balanced","documentPublicId":"<uuid>"}' \
  | jq '.data.status'
# Expected: "completed" (ไม่ fail)
```

*PowerShell:*
```powershell
$body = '{"type":"rag-query","executionProfile":"balanced","documentPublicId":"<uuid-here>"}'
(Invoke-RestMethod -Uri "$env:BACKEND_URL/ai/jobs" -Method POST -Headers @{
    "Authorization" = "Bearer $env:TOKEN"
} -Body $body).data.status
# Expected: "completed" (ไม่ fail)
```

**Step 3: ตรวจ sidecar log**
```bash
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
