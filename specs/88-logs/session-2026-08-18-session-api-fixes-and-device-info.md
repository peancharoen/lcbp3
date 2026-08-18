# Session 2026-08-18 — Session API Fixes + Device Info Tracking + ADR-045 Sync

## Summary

แก้ไขปัญหา session management API ครบทุกข้อใน session เดียว:
1. **Duplicate route** — ลบ session endpoints ซ้ำจาก `AuthController` ให้ `SessionController` เป็นเจ้าของเพียงตัวเดียว
2. **Role name mismatch** — แก้ role checks จาก `'ADMIN'`/`'DC'` เป็น `'Superadmin'`/`'Org Admin'`/`'Document Control'` ตาม DB จริง
3. **Device info tracking** — เพิ่ม `device_name`, `ip_address`, `user_agent`, `last_active_at` ใน `refresh_tokens` เพื่อแสดง device/IP จริงแทน "Unknown"
4. **Lint fix** — ลบ `Array.isArray()` dead code ที่ทำให้ ESLint ฟ้อง `unsafe return of any`
5. **ADR-045 sync** — อัปเดต Implementation Details ให้ตรง `/etc/cloudflared/config.yml` จริง (tunnel UUID, path-based routing, IP แทน localhost, hostnames ที่ขาด, pma port 81, remote config note)

## ปัญหาที่พบ (Root Cause)

### Bug 1: Duplicate route
`AuthController` (`@Controller('auth')` + `@Get('sessions')`) และ `SessionController` (`@Controller('auth/sessions')` + `@Get()`) ลงทะเบียน `/api/auth/sessions` ซ้ำกัน — `AuthController` ชนะเพราะลงทะเบียนก่อน และไม่มี admin role check ทำให้ผู้ใช้ทุกคนเข้าถึง session list ได้โดยไม่ตรวจสอบสิทธิ์

### Bug 2: Role name mismatch
`SessionController.checkAdminRole` เช็ค `roleName === 'ADMIN'` และ `roleName === 'DC'` แต่ role names จริงใน DB คือ `'Superadmin'`, `'Org Admin'`, `'Document Control'` — ทำให้ role check ไม่มีทางผ่าน

### Bug 3: Unknown Device/IP
`refresh_tokens` table ไม่มี columns สำหรับ device info และ `getActiveSessions()` คืน hardcoded `'Unknown Device'` / `'Unknown IP'`

### Bug 4: Lint error
`Array.isArray(rawIp) ? rawIp[0] : rawIp` — `rawIp` เป็น type `string | undefined` จาก Express types ไม่มีทางเป็น array ทำให้ `rawIp[0]` เป็น `any`

### Bug 5: ADR-045 drift
ADR-045 Implementation Details เขียนตาม memory เก่า ไม่ตรง config จริงหลายจุด (tunnel name แทน UUID, localhost แทน IP, ไม่มี path-based routing, hostnames ที่ขาด, pma port ผิด)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/common/auth/auth.controller.ts` | ลบ duplicate `getSessions()` + `revokeSession()` + unused imports `Delete`/`Param`; เพิ่ม helpers `getClientIp()` (CF-Connecting-IP → X-Forwarded-For → req.ip), `parseDeviceName()` (OS + browser parser), `getDeviceInfo()`; แก้ `login()` และ `refresh()` ให้ส่ง deviceInfo; ลบ `Array.isArray()` dead code |
| `backend/src/common/auth/session.controller.ts` | แก้ role checks เป็น `'Superadmin'`/`'Org Admin'`/`'Document Control'` + file header |
| `backend/src/common/auth/auth.service.ts` | `storeRefreshToken()` รับ deviceInfo; `login()` รับ deviceInfo จาก controller; `refreshToken()` รับ deviceInfo + update lastActiveAt; `getActiveSessions()` คืนค่าจริง |
| `backend/src/common/auth/entities/refresh-token.entity.ts` | เพิ่ม 4 columns: `deviceName`, `ipAddress`, `userAgent`, `lastActiveAt` (ระบุ `type: 'varchar'`/`'datetime'` ชัดเจน) + file header |
| `backend/src/common/auth/auth.controller.spec.ts` | แก้ test ให้ส่ง mock request พร้อม `get()`/`headers`/`ip`/`socket` |
| `specs/03-Data-and-Storage/deltas/2026-08-18-refresh-tokens-device-info.sql` | Schema delta SQL (ADR-044) — ALTER TABLE เพิ่ม 4 columns |
| `specs/06-Decision-Records/ADR-045-edge-proxy-topology-amendment.md` | อัปเดต Implementation Details v1.1 ให้ตรง config จริง + path-based routing table + remote config note + rule ordering warning |

## กฎที่ Lock แล้ว

- **Session routes** ต้องอยู่ใน `SessionController` เพียงตัวเดียว — ห้ามเพิ่ม session endpoints ใน `AuthController` อีก
- **Role checks** ต้องใช้ role names จริงจาก DB: `'Superadmin'`, `'Org Admin'`, `'Document Control'` — ห้ามใช้ `'ADMIN'`/`'DC'` ที่เป็น derived labels
- **Device info** ต้องเก็บตั้งแต่ login และ update ทุกครั้งที่ refresh token rotation
- **Cloudflare Tunnel config** ใช้ remote config จาก dashboard — local file `/etc/cloudflared/config.yml` เป็น documentation เท่านั้น
- **Path-based routing** สำหรับ `lcbp3.np-dms.work` ต้องเรียง priority: `^/api/auth/sessions` → `^/api/auth` → `^/api` → catch-all

## Verification

- [x] TypeScript compile ผ่าน (0 errors)
- [x] ESLint ผ่าน (0 errors หลังลบ `Array.isArray` dead code)
- [x] Auth tests 21/21 ผ่าน
- [x] Forbidden patterns: ไม่พบ `any`, `console.log`, `parseInt` ใน modified files
- [x] Backend startup สำเร็จ (ไม่มี TypeORM error หลังระบุ `type: 'varchar'`)
- [x] Route registration: ไม่มี duplicate (ก่อน: 2 ครั้ง, หลัง: 1 ครั้ง)
- [x] superadmin → `GET /api/auth/sessions` → 200 (ผ่าน role check)
- [x] viewer01 → `GET /api/auth/sessions` → 401 (ถูก reject)
- [x] curl login + sessions แสดง `Windows · Chrome 127` + `172.20.2.1` สำหรับ session ใหม่
- [x] Browser (public URL) หน้าแสดงผลถูกต้อง, 0 console errors
- [x] Schema delta รันบน DB สำเร็จ (DESCRIBE refresh_tokens ยืนยัน 4 columns ใหม่)
- [x] ADR-045 Implementation Details ตรง `/etc/cloudflared/config.yml` จริง
