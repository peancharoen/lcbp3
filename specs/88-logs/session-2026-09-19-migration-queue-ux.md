# Session — 2026-09-19 (Migration Queue UX: verify + back button + page size)

## Summary

ต่อจาก session ก่อนหน้า: verify URL-backed state ของ Legacy Review Queue บน production ด้วย browser จริง, พบว่า user ใช้ปุ่ม `<-` ในหน้า (ไม่ใช่ browser back) ซึ่งยัง hardcoded → แก้, และเพิ่ม page-size selector 10/20/50/100 ตาม request

## ปัญหาที่พบ (Root Cause)

1. **In-app back button เสีย state** — ปุ่ม `<-` บนหน้า `review/[id]` เป็น `<Link href="/admin/migration">` แบบ hardcoded ไป bare URL → ตกหน้า 1 เสมอ แม้ URL-state fix (`5861b89e`) จะทำให้ *browser* back ทำงานถูกแล้ว จุดเดียวกันนี้มีอีก 2 แห่ง: `router.push('/admin/migration')` หลัง commit import + reject
2. **Backend limit ไม่มี cap** — `PaginationDto.limit` มี `@Min(1)` แต่ไม่มี `@Max` → ใครส่ง `limit=100000` ก็ยิง query ใหญ่ได้

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | ------------- |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | `handleBack()` → `router.back()` 3 จุด (back button, post-commit, post-reject); fallback `push('/admin/migration')` เมื่อ `window.history.length <= 1` (deep link/แท็บใหม่); ลบ `import Link` |
| `frontend/app/(admin)/admin/migration/page.tsx` | page-size selector 10/20/50/100 ใน pagination footer — URL-backed `?limit=` (default 20 ไม่ขึ้น URL), เปลี่ยน size → reset หน้า 1, invalid value fallback 20 |
| `backend/src/modules/migration/dto/migration-queue-query.dto.ts` | `@Max(100)` บน `PaginationDto.limit` (DTO ใช้แค่ `getReviewQueue` — verified) |

## กฎที่ Lock แล้ว

- **D347 — In-app back navigation ต้อง `router.back()`** — detail page ที่เปิดจาก list ที่มี URL-backed state ต้องกลับด้วย `router.back()` (หรือส่ง return URL มา) ห้าม hardcode `<Link>` ไป bare list URL; เสมอ fallback `push()` เมื่อไม่มี history
- Page size ต้อง URL-backed เช่นเดียวกับ page/filters (D342 contract) + reset หน้า 1 เมื่อเปลี่ยน + backend ต้องมี `@Max` cap

## Verification

- check-real-app (Playwright MCP, superadmin, production `lcbp3.np-dms.work`): page 3 + `status=IMPORTED` → review → **browser** back → state คง — PASS เต็มรูปแบบ (screenshots `/tmp/check-real-app-2026-09-19/`, console clean, queue API 200; มี transient 503 1 ครั้งบน review HTML → retry 200)
- Back button fix + page-size: frontend tsc+eslint, backend tsc+eslint+queue spec 6/6 — **ยังไม่ browser-verify บน production** (deploy `3055ad73` กำลังรัน)

## Commits

- `fb60babc` back button `router.back()` + `6e02679d` page-size selector → squashed push **`3055ad73`** (CI deploy)
- `5af9753a` docs(memory) `[skip CI]`
