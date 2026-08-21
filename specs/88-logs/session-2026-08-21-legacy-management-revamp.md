# Session — 2026-08-21 (Legacy Management Tab Revamp + Session Tracking Fix)

## Summary

ปรับปรุงหน้า `/admin/migration` tab "Legacy Management" (เดิม "Legacy Queue") ให้ใช้ dropdown แทน manual input สำหรับ Excel file, Staging PDF folder, Project UUID, และ Contract Code พร้อมแก้ bug session tracking ที่แสดง "Unknown OS · Unknown Browser" บนหน้า `/admin/monitoring/sessions`

## ปัญหาที่พบ (Root Cause)

### ปัญหา 1: Session tracking แสดง "Unknown" (regression)
- **อาการ:** sessions ล่าสุดใน DB มี `user_agent = "node"`, `ip_address = "172.20.2.22"` (server) แทน browser จริง
- **Root cause:** NextAuth `authorize` ใน `frontend/lib/auth.ts` รันฝั่ง server (Next.js route handler) ทำให้ `fetch()` ส่ง `User-Agent: node` ไปยัง backend โดยไม่ส่งต่อ headers จาก browser จริง
- **ผลกระทบ:** session เดิม (token_id 98-99) แสดง "Windows · Chrome 127" ถูกต้อง แต่ session ใหม่กลับเป็น "Unknown"

### ปัญหา 2: Legacy Queue ใช้ manual input ที่ error-prone
- Excel file: ใช้ file upload เท่านั้น ทั้งที่มีไฟล์อยู่บน NAS `/mnt/asustor-legacy`
- Staging PDF: default path `/share/np-dms/staging_ai/` ไม่มีอยู่จริง
- Project UUID: expose UUIDv7 ใน input field (ละเมิด ADR-019 ที่ไม่ควร expose UUID)
- Contract Code: manual text input ทั้งที่มีข้อมูลใน DB

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `frontend/app/(admin)/admin/migration/page.tsx` | เปลี่ยนชื่อ tab "Legacy Queue" → "Legacy Management"; rename `LegacyQueueTab` → `LegacyManagementTab` |
| `backend/src/modules/migration/constants/migration.constants.ts` | เพิ่ม `ENV_LEGACY_NAS_PATH` + `LEGACY_NAS_PATH_DEFAULT` (`/mnt/asustor-legacy`) |
| `backend/src/modules/migration/migration.controller.ts` | เพิ่ม `GET /migration/legacy-files` (list .xlsx จาก NAS) + `GET /migration/legacy-folders` (list subdirectories) |
| `frontend/lib/services/migration.service.ts` | เพิ่ม `listLegacyExcelFiles()` + `listLegacyFolders()` |
| `frontend/components/migration/legacy-ingestion-card.tsx` | เขียนใหม่ทั้งหมด: Excel dropdown (NAS + upload), Staging PDF dropdown, Project Name dropdown, Contract Code dropdown (filter by project) |
| `frontend/lib/auth.ts` | เพิ่ม `getForwardedHeaders()` ใช้ `headers()` จาก `next/headers` (async ใน Next.js 16) ส่งต่อ User-Agent + IP headers ไปยัง backend ใน `authorize` + `refreshAccessToken` |

## กฎที่ Lock แล้ว

### D130 — Legacy NAS Path Convention
- `LEGACY_NAS_PATH` env var (default `/mnt/asustor-legacy`) เป็น root สำหรับ listing Excel files และ subdirectories
- Excel dropdown แสดงเฉพาะ `.xlsx`/`.xls` ที่อยู่ใน root เท่านั้น (ไม่ recurse)
- Staging PDF dropdown แสดง subdirectories ของ root (เช่น `Incoming/`, `Outgoing/`)
- คงไว้ซึ่ง upload option สำหรับกรณีที่ต้องการอัปโหลดไฟล์ใหม่

### D131 — NextAuth Header Forwarding Pattern
- NextAuth `authorize` และ `refreshAccessToken` รันฝั่ง server ทำให้ `User-Agent` เป็น `"node"` โดย default
- ต้องใช้ `headers()` จาก `next/headers` (async ใน Next.js 16) เพื่อดึง incoming request headers และส่งต่อไปยัง backend
- Headers ที่ต้องส่งต่อ: `user-agent`, `cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`
- ต้อง wrap ใน try-catch เพราะ `headers()` อาจ throw หากเรียกนอก request scope
- Sessions เดิมใน DB ยังคงแสดง "Unknown" จนกว่าผู้ใช้จะ login ใหม่หลัง deploy

## Verification

- [x] Backend `tsc --noEmit` ผ่าน
- [x] Frontend `tsc --noEmit` ผ่าน
- [x] ESLint ผ่านทั้งสองฝั่ง (frontend + backend)
- [x] Frontend `next build` ผ่าน
- [x] Backend `nest build` ผ่าน
- [x] Commit `652c88aa` push สำเร็จไปยัง `origin/main`
- [ ] **Deploy + browser test** — ทดสอบหน้า `/admin/migration` หลัง deploy
- [ ] **Session tracking verify** — login ใหม่หลัง deploy แล้วตรวจสอบว่า sessions แสดง device info ถูกต้อง
