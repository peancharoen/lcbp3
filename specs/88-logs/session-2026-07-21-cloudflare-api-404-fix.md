# Session — 2026-07-21 (Cloudflare Tunnel /api Routing Fix)

## Summary

แก้ปัญหา `GET https://lcbp3.np-dms.work/api/dashboard/stats` (และ `/api/*` ทั้งหมด) ตอบ `404` — สาเหตุคือ Cloudflare Tunnel ingress rule ของ `lcbp3.np-dms.work` ไม่มี path rule แยกไป backend หลัง cutover จาก NPM (ADR-041 Phase 5). แก้ที่ Cloudflare Zero Trust Dashboard ล้วน ๆ ไม่แก้โค้ด แต่พบ regression แทรก (login พัง) ระหว่างแก้ ต้องเพิ่ม rule เจาะจงอีกชั้น

## ปัญหาที่พบ (Root Cause)

1. **404 เดิม:** `docker-compose.yml` (`03-application`) ตั้ง `NEXT_PUBLIC_API_URL: 'https://lcbp3.np-dms.work/api'` (same-origin design — ดู comment ใน `frontend/proxy.ts` เรื่อง CSP `connect-src 'self'`) ซึ่งต้องพึ่ง reverse-proxy layer มี path rule `/api` → backend
2. หลัง ADR-041 Phase 5 ย้ายจาก NPM → **Cloudflare Tunnel**, ingress rules ใหม่ map ตาม **hostname เท่านั้น**:
   ```yaml
   - hostname: api.np-dms.work
     service: http://192.168.10.11:3000   # backend
   - hostname: lcbp3.np-dms.work
     service: http://192.168.10.11:3001   # frontend
   ```
   ไม่มี path-based rule แยก `/api/*` ของ `lcbp3.np-dms.work` ไป backend → ทุก request (รวม `/api/dashboard/stats`) วิ่งเข้า frontend (Next.js) ที่ไม่มี route นี้ → 404
3. **Regression ระหว่างแก้:** เพิ่ม rule `path: ^/api` → backend แล้ว **ไป intercept `/api/auth/*` ของ NextAuth ด้วย** (NextAuth mount API route ไว้ใน Next.js เอง ไม่ใช่ backend) → login พังตอน callback (`/api/auth/error` 404)

## การแก้ไข (Fix)

| ที่ไหน | การเปลี่ยนแปลง |
| --- | --- |
| Cloudflare Zero Trust Dashboard (Public Hostname routes, ไม่แก้ไฟล์ในโค้ด) | เพิ่ม 2 rules ให้ `lcbp3.np-dms.work` เรียงตามลำดับ (เจาะจงสุดก่อน): `path: ^/api/auth` → frontend (`192.168.10.11:3001`), แล้วตามด้วย `path: ^/api` → backend (`192.168.10.11:3000`), เหนือ catch-all rule เดิม (ไม่มี path → frontend) |

ไม่มีการแก้ไฟล์ในโค้ด (`frontend/proxy.ts`, `docker-compose.yml`, backend) เลย — เป็นการแก้ที่ edge/infra layer ล้วน ๆ

## กฎที่ Lock แล้ว

- Cloudflare Tunnel ingress rules ประเมินจาก **บนลงล่าง แบบ first-match** — rule ที่มี `path` ต้องอยู่เหนือ rule ที่ไม่มี `path` (catch-all) เสมอ สำหรับ hostname เดียวกัน
- `lcbp3.np-dms.work` ต้องมี ingress rule แยกตาม path เป็น 3 ชั้นตามลำดับนี้เท่านั้น: `^/api/auth` (frontend) → `^/api` (backend) → catch-all (frontend)
- ห้ามลบ/แก้ NPM proxy host เดิมของ `lcbp3.np-dms.work` — NPM demoted แล้วตาม ADR-041 Phase 5, Cloudflare Tunnel เป็น edge หลัก
- `NEXT_PUBLIC_API_URL` ยังคงเป็น `https://lcbp3.np-dms.work/api` (same-origin) ตาม design เดิม — ไม่ต้องเปลี่ยนเป็น `api.np-dms.work` ตรง ๆ

## Verification

- [x] `curl https://lcbp3.np-dms.work/api/dashboard/stats` (ไม่มี token) → `401 PERMISSION_DENIED` (route ถูกเจอแล้ว ไม่ใช่ 404)
- [x] Playwright: login (`admin` / `Center2025`) ที่ `https://lcbp3.np-dms.work/login` → redirect `/dashboard` สำเร็จ (ไม่พังที่ `/api/auth/error`)
- [x] Playwright network trace: `GET https://lcbp3.np-dms.work/api/dashboard/stats` → `200`
- [x] Dashboard UI แสดง stats cards (Total Correspondences, Active RFAs, Approved Documents, Pending Approvals) ถูกต้อง
