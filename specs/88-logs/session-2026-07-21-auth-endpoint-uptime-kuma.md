# Session — 2026-07-21 (Auth Endpoint & Uptime Kuma Monitoring)

## Summary

Q&A session เกี่ยวกับ Auth/Login endpoint และวิธีตั้งค่า Uptime Kuma monitor สำหรับ `https://api.np-dms.work/auth/login`

## ปัญหาที่สอบถาม (Questions)

### 1. Auth/Login endpoint คืออะไร?

ค้นพบ endpoint ที่ `backend/src/common/auth/auth.controller.ts`:

- **Route:** `POST /auth/login`
- **Controller:** `AuthController` (`@Controller('auth')`)
- **Rate Limiting:** `@Throttle({ default: { limit: 5, ttl: 60000 } })` — 5 requests/60s
- **Request Body:** `LoginDto` — `{ username: string, password: string }`
- **Response:** `{ access_token, refresh_token, user }`
- **Token Strategy:** Access Token (15m default) + Refresh Token (7d default); `migration_bot` ใช้ TTL พิเศษ (10y / 2y)
- **Validation:** bcrypt compare + role derivation จาก assignments (Superadmin/Org Admin → ADMIN, Document Control → DC, อื่นๆ → User)

### 2. ตรวจสอบด้วย Uptime Kuma อย่างไร?

Uptime Kuma รันที่ `https://uptime.np-dms.work` (ASUSTOR :3001) ตาม `04-03-monitoring.md`

**แนะนำ 2 ทาง:**

- **ทางที่ 1 (แนะนำ):** ใช้ `/health` endpoint สำหรับ availability monitoring (ไม่ต้องส่ง credentials, ไม่ถูก rate limit, ตรวจ DB/Redis/Disk ไปพร้อมกัน) — มีอยู่แล้วใน monitor table
- **ทางที่ 2:** ใช้ `HTTP(s) - Keyword` monitor สำหรับ `/auth/login` เป็น synthetic transaction monitoring — ตั้ง interval 300s (5 นาที) เพื่อหลีกเลี่ยง rate limit; ใช้ dummy credentials + check status code 401 (แปลว่า service ทำงานได้)

## การแก้ไข (Fix)

ไม่มี code changes ใน session นี้ — เป็น Q&A เท่านั้น

## กฎที่ Lock แล้ว

ไม่มี decision ใหม่ใน session นี้

## Verification

ไม่ต้อง verify (ไม่มี code changes)
