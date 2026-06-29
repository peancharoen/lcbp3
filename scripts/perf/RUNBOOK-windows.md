# Runbook: รัน k6 Performance Test บน Windows (PowerShell)

**Target:** ADR-021 T048 — Verify `POST /workflow-engine/instances/:id/transition` P95 ≤ 5s (Clarify Q4)

**Script:** `scripts/perf/workflow-transition.k6.js`

---

## Prerequisites

- Windows 10/11 + PowerShell 5.1+ (หรือ PowerShell 7+)
- `curl.exe` (built-in ตั้งแต่ Windows 10 1803+)
- Backend API รันอยู่ (localhost:3001 หรือ staging URL)
- ไฟล์ `test-5mb.pdf` (หรือขนาดใกล้เคียง ≤ 10MB)

---

## ขั้นที่ 1 — ติดตั้ง k6

เลือก **1 วิธี**:

```powershell
# Chocolatey
choco install k6

# winget
winget install k6.k6

# หรือ download manual: https://github.com/grafana/k6/releases
```

ตรวจสอบ:
```powershell
k6 version
# ควรได้: k6 v0.50.x (หรือใหม่กว่า)
```

---

## ขั้นที่ 2 — เตรียมข้อมูลทดสอบ (ทำครั้งเดียวก่อนรัน)

### 2.1 Login เอา JWT token

```powershell
$baseUrl = "http://localhost:3001"
$loginBody = '{"username":"admin","password":"YOUR_PASSWORD"}'

$loginRes = curl.exe -s -X POST "$baseUrl/api/auth/login" `
  -H "Content-Type: application/json" `
  -d $loginBody | ConvertFrom-Json

$token = $loginRes.data.accessToken
Write-Host "Token: $token" -ForegroundColor Green
```

### 2.2 อัปโหลดไฟล์ทดสอบ (Two-Phase)

```powershell
# Phase 1 — Upload (temp)
$uploadRes = curl.exe -s -X POST "$baseUrl/api/files/upload" `
  -H "Authorization: Bearer $token" `
  -F "file=@test-5mb.pdf" | ConvertFrom-Json

$tempId = $uploadRes.data.tempId
$publicId = $uploadRes.data.publicId
Write-Host "publicId=$publicId" -ForegroundColor Yellow

# Phase 2 — Commit (is_temporary=false)
curl.exe -s -X POST "$baseUrl/api/files/commit" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d "{\""tempId\"":\""$tempId\""}"
```

### 2.3 หา Workflow Instance ID

เลือก **1 วิธี**:

**วิธี A — Query DB โดยตรง (แนะนำ):**
```sql
SELECT id, current_state
FROM workflow_instances
WHERE current_state IN ('PENDING_REVIEW', 'PENDING_APPROVAL')
LIMIT 1;
```

**วิธี B — สร้าง RFA ใหม่แล้ว submit:**
```powershell
# สร้าง RFA → submit → workflow instance จะอยู่ใน PENDING_REVIEW อัตโนมัติ
# (ดู backend/test/rfa.e2e-spec.ts สำหรับ payload ตัวอย่าง)
```

```powershell
$instanceId = "<UUID ที่ได้>"
```

---

## ขั้นที่ 3 — ตั้ง Environment Variables

```powershell
$env:BASE_URL        = "http://localhost:3001"
$env:USERNAME        = "admin"
$env:PASSWORD        = "YOUR_PASSWORD"
$env:INSTANCE_ID     = $instanceId
$env:ATTACHMENT_UUID = $publicId
```

---

## ขั้นที่ 4 — รัน k6

```powershell
# จาก repo root
k6 run scripts/perf/workflow-transition.k6.js
```

### ผลลัพธ์ที่คาดหวัง (Success)

```
     ✓ login successful
     ✓ status is 2xx
     ✓ duration < 5s (P95 SLA)

     checks.........................: 100.00% ✓ 20 ✗ 0
     http_req_duration..............: avg=2.1s  p(95)=3.0s
   ✓ transition_duration_ms.........: avg=2102  p(95)=3021
   ✓ http_req_failed................: 0.00%

running (0m22.5s), 0/1 VUs, 10 complete and 0 interrupted iterations
```

**ผ่าน SLA** เมื่อเห็น `✓` ที่:
- `transition_duration_ms.........: p(95) < 5000`
- `http_req_failed................: rate < 0.01`

### ตัวอย่าง Failure

```
   ✗ transition_duration_ms
      p(95)=6821 (≥ 5000)

   ✗ some iterations failed
```

Exit code ≠ 0 → ใช้เป็น CI gate ได้ทันที

---

## Troubleshooting

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| **HTTP 409 Conflict** ตั้งแต่ iter แรก | Instance ไม่อยู่ใน `PENDING_REVIEW`/`PENDING_APPROVAL` | ใช้ SQL ใน 2.3 วิธี A เพื่อหา instance ที่ state ถูกต้อง |
| **HTTP 409** iter 2+ | iter 1 ทำให้ state เป็น `APPROVED` | (ก) ใช้ workflow DSL ที่ action กลับมา pending ได้ (เช่น `RETURN`) (ข) re-create instance ก่อนรัน |
| **HTTP 400** "Idempotency-Key required" | Header หาย | ตรวจบรรทัด `'Idempotency-Key': idempotencyKey` ใน script (line ~94) |
| **HTTP 403 Forbidden** | User ไม่ใช่ assigned handler | login ด้วย superadmin หรือ set `context.assignedUserId` = user_id ของ test user |
| **Attachment mismatch** | `isTemporary=true` หรือ publicId ซ้ำ | re-run 2.2 เอา publicId ใหม่ทุกครั้ง |
| **P95 > 5s** ทุก iter | ClamAV scan / Redis ช้า | ตรวจ `docker stats` — ClamAV RAM ≥ 1GB, Redis connection pool ≥ 10 |
| **Cannot connect** | Backend ไม่รัน / port ชน | `docker compose ps` ตรวจ container healthy |

---

## Cleanup (หลังทดสอบ)

```powershell
# Reset env vars (ถ้าต้องการ)
Remove-Item Env:\BASE_URL, Env:\USERNAME, Env:\PASSWORD, `
            Env:\INSTANCE_ID, Env:\ATTACHMENT_UUID
```

---

## Manual Fallback (ไม่มี k6)

```powershell
$results = @()
1..10 | ForEach-Object {
  $idk = [guid]::NewGuid().ToString()
  $body = "{\""action\"":\""APPROVE\"",\""attachmentPublicIds\"":[\""$env:ATTACHMENT_UUID\""]}"

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $status = curl.exe -s -o $null -w "%{http_code}" -X POST `
    "$env:BASE_URL/api/workflow-engine/instances/$env:INSTANCE_ID/transition" `
    -H "Authorization: Bearer $token" `
    -H "Idempotency-Key: $idk" `
    -H "Content-Type: application/json" `
    -d $body
  $sw.Stop()

  $results += [PSCustomObject]@{
    Iter = $_
    Status = $status
    DurationMs = $sw.ElapsedMilliseconds
  }
}

$results | Format-Table
$p95 = ($results.DurationMs | Sort-Object)[[int]([math]::Ceiling($results.Count * 0.95) - 1)]
Write-Host "P95 = $p95 ms (SLA: < 5000)" -ForegroundColor $(if ($p95 -lt 5000) {'Green'} else {'Red'})
```

---

## Sign-off Checklist

- [ ] k6 run exit code = 0
- [ ] `transition_duration_ms p(95) < 5000` ✓
- [ ] `http_req_failed rate < 0.01` ✓
- [ ] ทดสอบทั้ง 4 modules: RFA, Transmittal, Circulation, Correspondence (1 ครั้ง/module)
- [ ] ทดสอบซ้ำบน staging environment (ไม่ใช่เฉพาะ localhost)
- [ ] บันทึกผลลัพธ์ใน `specs/88-logs/perf-YYYY-MM-DD.md`

**Sign-off ที่ staging = ปิด T048 ได้จริง**
