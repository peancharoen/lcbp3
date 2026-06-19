# Session — 2026-06-19 (AI Admin Response Normalization)

## Summary

แก้ bug หน้า `admin/ai` เมื่อกดแท็บ `3-Step Pipeline Sandbox` แล้วขึ้น `Admin Panel Error e.map is not a function` และแก้ VRAM GPU Monitor ที่แสดง `0 MB / 0 MB` แต่ขึ้น `หน่วยความจำไม่เพียงพอ (OOM Guard)` ผิดสถานะ

## ปัญหาที่พบ (Root Cause)

Frontend AI Admin service unwrap API response ได้เพียงชั้นเดียว ทำให้ response ที่ถูกห่อ `data` ซ้อนกันอ่านค่า VRAM เป็น `0/0` และ prompt list กลายเป็น object แทน array ก่อนส่งเข้า component ที่ใช้ `.find()` / `.map()`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | --------------- |
| `frontend/lib/services/admin-ai.service.ts` | เพิ่ม recursive `extractData()` สำหรับ API envelope ซ้อนกัน และปรับ VRAM unknown capacity (`totalVRAMMB = 0`) ไม่ให้แสดง OOM Guard |
| `frontend/lib/services/admin-ai-prompt.service.ts` | เพิ่ม response normalization ให้ `getPrompts()` คืน array เสมอ และ unwrap response สำหรับ create/activate/update note |
| `frontend/lib/services/__tests__/admin-ai.service.test.ts` | เพิ่ม regression tests สำหรับ VRAM double-wrapper, unknown VRAM, prompt list wrapper, และ non-array prompt payload |

## กฎที่ Lock แล้ว

- AI Admin frontend service ต้อง normalize API response envelope ที่อาจซ้อน `data` ก่อนส่งให้ UI render
- `totalVRAMMB = 0` ใน frontend หมายถึง capacity unknown ไม่ใช่ OOM; ห้ามแสดง OOM Guard จากข้อมูล VRAM ที่ไม่รู้ total

## Verification

- [x] `pnpm --filter lcbp3-frontend exec vitest run lib/services/__tests__/admin-ai.service.test.ts components/admin/ai/__tests__/SandboxTabs.test.tsx components/admin/ai/__tests__/sandbox-tabs.test.tsx` ผ่าน 3 files / 9 tests
- [x] `pnpm --filter lcbp3-frontend exec tsc --noEmit` ผ่าน
- [x] `git diff --check -- frontend/lib/services/admin-ai.service.ts frontend/lib/services/admin-ai-prompt.service.ts frontend/lib/services/__tests__/admin-ai.service.test.ts` ผ่าน
