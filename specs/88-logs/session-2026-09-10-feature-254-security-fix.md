# Session — 2026-09-10 (Feature 254 Static-Analysis P1-P4 Fix)

## Summary

แก้ไข vulnerabilities ทั้งหมดที่พบจาก static analysis run ของ Feature 254 — ลดจาก 17 advisories เหลือ 1 (เฉพาะ `adm-zip` ที่ไม่มี patch และมี code mitigation แล้ว)

## ปัญหาที่พบ (Root Cause)

Static analysis (pnpm audit + tsc + eslint) พบ 17 vulnerabilities แบ่งเป็น:
- 2 critical (next RCE บน Windows + Image Optimization)
- 5 high (multer DoS, nodemailer quadratic, sharp libheif)
- 7 moderate (vitest path traversal, adm-zip symlink, morgan log forging, nodemailer bypass)
- 3 low (joi prototype pollution, multer race)

Root cause: dependency versions ค้างอยู่ที่เวอร์ชันเก่า และ `pnpm-workspace.yaml` overrides ตั้งไว้ต่ำเกินไป (เช่น `multer@<2.2.0` ทั้งที่ patch อยู่ที่ 2.3.0)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/package.json` | multer `^2.0.2`→`^2.3.0`, nodemailer `^9.0.1`→`^9.1.1`, joi `^18.2.1`→`^18.2.5` |
| `frontend/package.json` | next `16.3.1`→`16.3.3`, vitest `^4.1.9`→`^4.1.11` |
| `pnpm-workspace.yaml` | อัปเดต 7 overrides (next, multer, sharp, morgan, nodemailer, joi, vitest) — ทั้งหมด bounded ตาม D144 |
| `pnpm-lock.yaml` | regenerate |
| `backend/src/common/file-storage/secure-archive.service.ts` | เพิ่ม `rejectSymlinks()` post-extraction check (adm-zip GHSA-vwc7-r8mq-g2x9 mitigation — ไม่มี patch ให้ upgrade จึงต้อง block ที่ code) |
| `backend/src/common/file-storage/secure-archive.service.spec.ts` | เพิ่ม 2 tests สำหรับ symlink rejection |

## กฎที่ Lock แล้ว

- **D295 — adm-zip ไม่มี patched version ต้องใช้ defense-in-depth code mitigation** — `adm-zip@0.6.0` มี GHSA-vwc7-r8mq-g2x9 (symlink-following arbitrary file overwrite) โดยไม่มี patched release; แก้ด้วย `rejectSymlinks()` recursive scan หลัง `extractAllTo()` ปฏิเสธ symlink ใด ๆ ใน extractDir ด้วย `BadRequestException`; กฎ: archive library ที่ไม่มี patch ต้อง wrap ด้วย validation layer ของเราเอง ไม่ใช่รอ upstream
- **D296 — pnpm 12 overrides อยู่ใน `pnpm-workspace.yaml` ไม่ใช่ `package.json`** — pnpm 12 เลิกอ่าน `pnpm.overrides` ใน `package.json` แล้ว (warn "no longer read"); ต้องย้ายไป `pnpm-workspace.yaml` ที่ root ของ workspace; กฎทั่วไป: pnpm settings ทั้งหมด (overrides, allowBuilds, shamefullyHoist, etc.) อยู่ที่ `pnpm-workspace.yaml` ใน pnpm 12+

## Verification

- [x] backend `tsc --noEmit` — 0 errors
- [x] backend `lint:ci` — 0 errors
- [x] frontend `tsc --noEmit` — 0 errors
- [x] frontend `lint` — 0 errors
- [x] frontend `vitest run` — 150 files / 1056 tests pass
- [x] `secure-archive.service.spec` — 18/18 pass (incl. 2 new symlink rejection tests)
- [x] RAG E2E (`rag-*`) — 40/45 pass (5 failures = pre-existing `ECONNREFUSED 127.0.0.1:3306` MariaDB unavailable, ไม่ใช่ regression)
- [x] `pnpm audit` — 17 → 1 advisory (เฉพาะ `adm-zip` ที่ไม่มี patch, mitigated ใน code)
- [x] commit `d920bf8a` บน branch `254-rag-attachment-chunks`
