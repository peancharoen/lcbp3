# Session — 2026-10-12 (Frontend Color Tokens + Tailwind Prettier Plugin)

## Summary

วิเคราะห์บทความ Tailwind/shadcn best practices แล้วปรับใช้กับ frontend (Tailwind 3.4.3): เพิ่ม prettier plugin, semantic color tokens, migrate สีสถานะทั้งแอป, format ทั้ง frontend; ประเมิน Tailwind v4 แล้วตัดสินใจไม่ย้าย

## ปัญหาที่พบ (Root Cause)

- สีสถานะใช้ palette ดิบ ~668 จุด ไม่มี token `success/warning/info` และ dark mode ต้อง override ทีละจุด
- `prettier-plugin-tailwindcss@0.8.1` crash กับ prettier 3.6.2 (`e.charAt is not a function`) — ใช้ 3.9.9 ได้ แต่ prettier อยู่ใน backend devDep จึงไม่อัป
- dark `--destructive` (30.6% L) มืดเกินใช้เป็นสีข้อความ

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | -------------- |
| `frontend/.prettierrc`, `frontend/package.json`, `pnpm-lock.yaml` | plugin 0.7.4 (pin), `tailwindFunctions: [cn, cva]` |
| `frontend/app/globals.css`, `frontend/tailwind.config.ts` | tokens success/warning/info (+foreground), ปรับ dark destructive + light warning |
| 99 ไฟล์ใน `app/`, `components/` | แทนสีดิบ 641 จุดด้วย tokens, ลบ `dark:` สีซ้ำซ้อน |
| 368 ไฟล์ frontend | `prettier --write --ignore-path ../.prettierignore` (revert `eslint-frontend.json`, `__tests__/README.md`) |

## กฎที่ Lock แล้ว

ดู D365 — ใช้ tokens แทนสีดิบ, อยู่ Tailwind v3, plugin pin 0.7.4

## Tailwind v4 Risk (เพื่อตัดสินใจในอนาคต)

class ที่ต้องเปลี่ยน ~228 จุด / 81 จาก 390 ไฟล์ (rounded 95, shadow-sm 32, backdrop-blur 37, outline-none 26, flex-shrink 15, blur 13, rounded-sm 8, ring 2); animate (`tw-animate-css`) 11 ไฟล์ใน `components/ui`; มี unit test 178 ไฟล์ แต่ E2E 2 spec และ visual regression 0 → ต้องสร้าง baseline ก่อน

## Verification

- [x] `tsc --noEmit`, `eslint --quiet`, vitest 176 files / 1,234 tests ผ่าน
- [x] squash push `852feda8` → origin/main
- [ ] ตรวจหน้าจริง light/dark (migration, admin/ai, error-display, dashboard, workflow)
