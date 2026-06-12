// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/checklists/cutover-validation.md
// Change Log:
// - 2026-06-11: Initial cutover validation checklist for T032 and sidecar pytest

# Cutover Validation Checklist: Feature 235

**Purpose**: ใช้ปิด `T032` และเก็บหลักฐานสำหรับเลื่อนสถานะ validation จาก `PARTIAL` ไป `PASS`

> หมายเหตุ
>
> - Checklist นี้อิง **implementation ปัจจุบัน** ของ Option B
> - อย่าใช้ตัวอย่างเก่าใน `quickstart.md` ที่ยังส่ง `executionProfile` / `large-context` จาก caller
> - คำสั่งด้านล่างเป็น **PowerShell** ตามกฎของ repo

## 1. Environment Ready

- [ ] Backend รันที่ `http://localhost:3001`
- [ ] Frontend รันที่ `http://localhost:3000`
- [ ] OCR sidecar รันที่ `http://192.168.10.100:8765`
- [ ] Ollama รันและมี tag `np-dms-ai` / `np-dms-ocr`
- [ ] มี admin token สำหรับเรียก API
- [ ] มี `documentPublicId` และ `projectPublicId` ที่มีอยู่จริงสำหรับทดสอบ `rag-query`
- [ ] มีไฟล์ PDF ตัวอย่างสำหรับ OCR Sandbox

## 2. Automated Validation

### 2.1 Backend targeted tests

- [ ] รัน:

```powershell
pnpm --filter backend test -- --runInBand --testPathPatterns="ai.service.spec.ts|queue-policy.spec.ts|ai.controller.spec.ts|ai-policy.service.spec.ts|ocr-residency.spec.ts|vram-monitor.service.spec.ts"
```

- [ ] Expected: ทุก suite ผ่าน

### 2.2 Backend build

- [ ] รัน:

```powershell
pnpm --filter backend build
```

- [ ] Expected: build ผ่านไม่มี compile error

### 2.3 Sidecar pytest

- [ ] รัน:

```powershell
python -m pytest specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests -v
```

- [ ] Expected: `test_retrieval_fallback.py` ผ่านครบ
- [ ] ถ้า `pytest` ไม่พบ module: บันทึกว่า environment ยังไม่พร้อม และติดตั้ง dependency ก่อน rerun

## 3. Manual Gate 1: Policy Contract

ตั้งค่า token และ ids ก่อน:

```powershell
$TOKEN = "<admin-jwt>"
$PROJECT_PUBLIC_ID = "<existing-project-public-id>"
$DOCUMENT_PUBLIC_ID = "<existing-document-public-id>"
```

### 3.1 Reject forbidden `model`

- [ ] รัน:

```powershell
$body = @{
  type = "rag-query"
  projectPublicId = $PROJECT_PUBLIC_ID
  payload = @{ query = "test policy contract" }
  model = @{ key = "typhoon2.5-np-dms:latest" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "http://localhost:3001/api/ai/jobs" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer $TOKEN"
    "Idempotency-Key" = "feature235-gate1-model"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

- [ ] Expected: HTTP `400`

### 3.2 Reject forbidden `executionProfile`

- [ ] รัน:

```powershell
$body = @{
  type = "rag-query"
  projectPublicId = $PROJECT_PUBLIC_ID
  payload = @{ query = "test forbidden profile" }
  executionProfile = "quality"
} | ConvertTo-Json -Depth 5
```

- [ ] Expected: HTTP `400`

### 3.3 Reject forbidden parameter override

- [ ] รัน:

```powershell
$body = @{
  type = "rag-query"
  projectPublicId = $PROJECT_PUBLIC_ID
  payload = @{ query = "test forbidden temperature" }
  temperature = 0.9
} | ConvertTo-Json -Depth 5
```

- [ ] Expected: HTTP `400`

### 3.4 Valid `rag-query`

- [ ] รัน:

```powershell
$body = @{
  type = "rag-query"
  projectPublicId = $PROJECT_PUBLIC_ID
  documentPublicId = $DOCUMENT_PUBLIC_ID
  payload = @{ query = "สรุปเอกสารนี้" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "http://localhost:3001/api/ai/jobs" `
  -Method Post `
  -Headers @{
    Authorization = "Bearer $TOKEN"
    "Idempotency-Key" = "feature235-gate1-valid"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

- [ ] Expected:
  - HTTP `201`
  - `modelUsed = "np-dms-ai"`
  - `effectiveProfile = "standard"`
  - `queueName = "ai-batch"`

## 4. Manual Gate 2: Canonical Naming

### 4.1 Audit log check

- [ ] ตรวจ row ล่าสุดใน `ai_audit_logs`
- [ ] Expected:
  - `effective_profile` มีค่า
  - `canonical_model` เป็น `np-dms-ai` หรือ `np-dms-ocr`
  - ไม่มี runtime name หลุดออกในฟิลด์ user-facing

### 4.2 Admin Console check

- [ ] เปิด `http://localhost:3000/admin/ai`
- [ ] ตรวจ Overview / health / model cards
- [ ] Expected:
  - เห็น `np-dms-ai`
  - เห็น `np-dms-ocr`
  - ไม่เห็น `typhoon2.5-np-dms:latest`
  - ไม่เห็น `typhoon-np-dms-ocr:latest`

### 4.3 OCR Sandbox badge check

- [ ] เปิด OCR Sandbox ในหน้า admin AI
- [ ] รัน OCR 1 รอบ
- [ ] Expected:
  - badge หรือ result label แสดง `np-dms-ocr`
  - ไม่โชว์ runtime name โดยตรง

## 5. Manual Gate 3: Adaptive OCR Residency

### 5.1 High-pressure / deep-analysis behavior

- [ ] ทำให้ main model กิน VRAM สูง หรือจำลอง workload ที่เข้าข่าย pressure
- [ ] รัน OCR Sandbox หรือ OCR job
- [ ] ตรวจ sidecar / backend logs
- [ ] Expected:
  - `keep_alive = 0`
  - reason เป็น `high-pressure` หรือ `deep-analysis-active`

### 5.2 Headroom sufficient behavior

- [ ] รัน OCR job ตอนที่ GPU headroom สูง
- [ ] ตรวจ logs
- [ ] Expected:
  - `keep_alive > 0`
  - reason เป็น `headroom-sufficient`

## 6. Manual Gate 4: Retrieval CPU Fallback

### 6.1 Force GPU pressure

- [ ] warm model:

```powershell
$warm = @{
  model = "np-dms-ai"
  prompt = "warmup"
  keep_alive = -1
} | ConvertTo-Json

Invoke-RestMethod "http://localhost:11434/api/generate" `
  -Method Post `
  -ContentType "application/json" `
  -Body $warm
```

### 6.2 Submit `rag-query` under pressure

- [ ] ส่ง request แบบเดียวกับ Gate 1.4 แต่เปลี่ยน `Idempotency-Key`
- [ ] Expected:
  - request enqueue สำเร็จ
  - job ไม่ fail hard

### 6.3 Verify fallback evidence

- [ ] ตรวจ sidecar logs
- [ ] Expected:
  - `device=cpu` หรือ `device: cpu`
  - reason เป็น `gpu-headroom-below-threshold` หรือ `gpu-query-failed`

## 7. Evidence to Attach

- [ ] backend test output
- [ ] backend build output
- [ ] sidecar pytest output
- [ ] screenshot หน้า `/admin/ai`
- [ ] screenshot OCR Sandbox result
- [ ] copy log line ของ residency decision
- [ ] copy log line ของ CPU fallback
- [ ] sample successful `rag-query` response body

## 8. Pass Criteria

- [ ] Automated backend tests ผ่าน
- [ ] Backend build ผ่าน
- [ ] Sidecar pytest ผ่าน
- [ ] Gate 1 ผ่านครบ
- [ ] Gate 2 ผ่านครบ
- [ ] Gate 3 ผ่านครบ
- [ ] Gate 4 ผ่านครบ
- [ ] หลักฐานถูกแนบหรือบันทึกไว้ใน feature folder

## 9. Follow-up After Completion

- [ ] update `tasks.md` ให้ติ๊ก `T032`
- [ ] update `validation-report.md` จาก `PARTIAL` เป็น `PASS`
- [ ] ถ้าเจอ spec drift ให้ปรับ `quickstart.md` และจุดอ้างอิงที่ยังใช้ contract เก่า
