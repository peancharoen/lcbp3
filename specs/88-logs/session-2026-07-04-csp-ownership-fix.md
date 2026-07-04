# Session — 2026-07-04 (CSP HTTPS Variant + Runtime File Ownership Fix)

## Summary

แก้ปัญหา CSP `connect-src` บล็อก request ไป backend เมื่อ browser อัปเกรด `http://` → `https://` โดย `upgrade-insecure-requests` แต่ CSP มีแค่ `http://` variant; และแก้ ownership ของ runtime docker-compose files ที่เป็น `root:root` ทำให้ deploy script ownership guard ล้มเหลว

## ปัญหาที่พบ (Root Cause)

### 1. CSP Protocol Mismatch

- `proxy.ts` สร้าง CSP header ที่ `connect-src` มีแค่ `http://192.168.10.11:3000`
- CSP มี `upgrade-insecure-requests` ซึ่งบังคับ browser อัปเกรด `http://` → `https://`
- Browser ยิง `https://192.168.10.11:3000/api/ai/status` แต่ CSP ไม่อนุญาต `https://` → บล็อก
- Error: `Connecting to 'https://192.168.10.11:3000/api/ai/status' violates the following Content Security Policy directive`

### 2. Runtime File Ownership

- ไฟล์ `docker-compose.yml` ใน `/opt/np-dms/{01-infrastructure,02-platform,03-application}/` เป็นของ `root:root` (สร้างตอน initial server setup)
- `deploy.sh` step `[0/4]` ownership guard ตรวจพบว่าไม่ใช่ของ `np-dms` → `exit 1`
- เคยแก้ใน session 2026-07-03 แต่ไฟล์กลับเป็น `root` อีก (น่าจะมีการ copy ใหม่โดย root)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `frontend/proxy.ts` | เพิ่ม `https://` variant ของ API origin ใน `connect-src` — เมื่อ `NEXT_PUBLIC_API_URL` เป็น `http://` ให้สร้าง `https://` variant อัตโนมัติ; default รวมทั้ง `http` และ `https` ของทั้ง `192.168.10.11:3000` และ `localhost:3000` |
| Server (one-time) | `sudo chown np-dms:np-dms /opt/np-dms/{01-infrastructure,02-platform,03-application}/docker-compose.yml` |

## กฎที่ Lock แล้ว

- **D38:** CSP `connect-src` ต้องมีทั้ง `http://` และ `https://` variant ของ API origin เมื่อใช้ `upgrade-insecure-requests` — ไม่งั้น browser อัปเกรด protocol แล้วบล็อกเอง

## Verification

- [x] `ls -la` ยืนยันไฟล์ทั้ง 3 layers เป็น `np-dms:np-dms`
- [x] Backend health check ผ่าน — `database: "up"`, `storage: "up"`
- [ ] CI deploy สำเร็จหลัง push commit นี้ (CSP fix)
- [ ] Frontend ไม่มี CSP violation ใน browser console
