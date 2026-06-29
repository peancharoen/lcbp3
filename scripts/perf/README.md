# Performance Verification Scripts

## T048: ADR-021 Workflow Transition P95 SLA

**Target:** `POST /workflow-engine/instances/:id/transition` (พร้อม file ≤ 10MB) ต้องตอบสนองภายใน **P95 ≤ 5 วินาที** (Clarify Q4)

ครอบคลุม: ClamAV scan + Redlock acquire + DB transaction

---

## Prerequisites

### 1. ติดตั้ง k6

```powershell
# Windows (Chocolatey)
choco install k6

# หรือ Download binary จาก https://k6.io/docs/getting-started/installation
```

### 2. เตรียมข้อมูลทดสอบ

ต้องมี workflow instance และ attachment ที่ commit แล้วพร้อมใช้:

```bash
# ก. Login เพื่อเอา JWT token + user_id
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"xxx"}'

# ข. อัปโหลดไฟล์ 5MB PDF (Two-Phase: upload → commit)
curl -X POST http://localhost:3001/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-5mb.pdf"
# จะได้ publicId + tempId

curl -X POST http://localhost:3001/api/files/commit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tempId":"<temp>"}'
# จะได้ publicId ที่ is_temporary=false

# ค. สร้าง / หา workflow instance ในสถานะ PENDING_REVIEW หรือ PENDING_APPROVAL
#    (ดู quickstart.md Step 3-4)
```

---

## Run Test

```powershell
# กำหนด env vars
$env:BASE_URL = "http://localhost:3001"
$env:USERNAME = "admin"
$env:PASSWORD = "xxx"
$env:INSTANCE_ID = "<workflow instance UUID>"
$env:ATTACHMENT_UUID = "<committed attachment publicId>"

# รัน smoke test (1 VU × 10 iterations)
k6 run scripts/perf/workflow-transition.k6.js
```

### ผลลัพธ์ที่คาดหวัง

```
✓ transition_duration_ms.............: p(95) < 5000 ✓
✓ http_req_failed.....................: rate < 0.01 ✓

running (00m12.3s), 0/1 VUs, 10 complete and 0 interrupted iterations
```

---

## Manual Fallback (ถ้าไม่มี k6)

รัน 10 ครั้งแล้วคำนวณ P95 เอง:

```bash
for i in {1..10}; do
  curl -X POST "http://localhost:3001/api/workflow-engine/instances/$INSTANCE_ID/transition" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $(uuidgen)" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"APPROVE\",\"attachmentPublicIds\":[\"$ATTACHMENT_UUID\"]}" \
    -w "Request $i: %{time_total}s (HTTP %{http_code})\n" \
    -o /dev/null -s
done
```

ผลที่ยอมรับได้:
- ทุก request < 5.0s (P95 ≤ 5s)
- HTTP 2xx สำหรับ request แรก และ cached 200 สำหรับ request ถัดไปที่ใช้ key เดิม

---

## Troubleshooting

| อาการ | สาเหตุที่น่าจะเป็น | แก้ |
|---|---|---|
| P95 > 5s | ClamAV scan ช้า / Redis ล่าช้า | ตรวจ `docker stats` — ClamAV RAM, Redis connection pool |
| HTTP 409 | Instance อยู่ใน Terminal state | เตรียม instance ใหม่ใน PENDING_REVIEW |
| HTTP 503 | Redis ล่ม / Redlock timeout | ตรวจ Redis container health |
| HTTP 400 | Idempotency-Key missing | ตรวจ header ใน k6 script |
| HTTP 403 | User ไม่มีสิทธิ์ | ใช้ assigned handler หรือ superadmin |
