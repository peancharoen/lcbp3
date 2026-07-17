# Session — 2026-07-16 (Migration Verification: Health Endpoint + Frontend Redirect)

## Summary

ตรวจสอบ migration plan step 4.10 และ 4.11 — แก้ไข MIGRATION-PLAN.md ให้สอดคล้องกับ actual behavior ของ backend และ frontend

## ปัญหาที่พบ (Root Cause)

### 4.10: `/api/health` ส่ง 404

- **สาเหตุ:** `main.ts` ตั้ง `app.setGlobalPrefix('api', { exclude: ['health', 'metrics'] })` — `health` ถูก exclude จาก `api` prefix จึงอยู่ที่ `/health` ไม่ใช่ `/api/health`
- MIGRATION-PLAN.md เดิมระบุ URL เป็น `http://192.168.10.11:3000/api/health` ซึ่งผิด

### 4.11: Frontend `/` ส่ง 307 ไม่ใช่ 200

- **สาเหตุ:** `app/page.tsx` เรียก `redirect('/dashboard')` ซึ่ง Next.js ส่ง 307 redirect; หากยังไม่ login จะถูก middleware redirect ต่อไป `/login`
- MIGRATION-PLAN.md เดิมคาดหวัง 200 ซึ่งไม่ถูกต้อง

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/MIGRATION-PLAN.md` | 4.10: `/api/health` → `/health` พร้อม comment อธิบาย exclude จาก api prefix; expected output เปลี่ยนจาก "DB/Redis/ES status" เป็น "DB/Memory/Disk status" (ตรงตาม terminus health check จริง) |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/MIGRATION-PLAN.md` | 4.11: expected 200 → 307 พร้อม comment อธิบาย redirect chain `/` → `/dashboard` → `/login` |

## Verification

- [x] `curl -s http://192.168.10.11:3000/health` → 200 พร้อม `database: up, memory_heap: up, storage: up`
- [x] `curl -s -o /dev/null -w "%{http_code}" http://192.168.10.11:3001/` → 307 (expected redirect)
- [x] `curl -s http://192.168.10.11:9924/metrics | head -20` → Prometheus format (Go runtime metrics; Ollama-specific metrics อยู่ด้านล่าง)
