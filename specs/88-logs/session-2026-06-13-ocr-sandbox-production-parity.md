# Session — 2026-06-13 (OCR Sandbox-Production Parity & Polish)

## Summary

สำเร็จการทำงานใน Phase 9 (Polish) สำหรับ Feature-236 (Unified OCR Architecture & Sandbox Parity) โค้ดได้รับการปรับปรุงให้ Type-safe 100%, แก้ไขข้อผิดพลาดของ ESLint และ Prettier, และรันการทดสอบผ่าน 100% (256/256 tests) ทั้งใน Frontend และ Backend

## ปัญหาที่พบ (Root Cause)

1. **การ import ExecutionProfile ใน ai.controller.ts หายไป**: ทำให้ ESLint ไม่สามารถแปลงและตรวจสอบประเภทของ ExecutionProfile ได้อย่างถูกต้อง ส่งผลให้เกิดข้อผิดพลาด `Unsafe argument of type error typed...`
2. **การ Cast ประเภทแบบไม่ปลอดภัยใน getProductionProfile**: การใช้ `profileName as ExecutionProfile` โดยตรงจากตัวแปร `string` ถูกตั้งข้อสังเกตจาก ESLint ในบางสภาพแวดล้อม
3. **ข้อผิดพลาด Unsafe member access ใน ai.controller.spec.ts**: ตัวแปร `req` ที่คืนค่าจาก `context.switchToHttp().getRequest()` ถูกอนุมานเป็น `any` โดยอัตโนมัติ ทำให้การกำหนดค่า `req.user` แจ้งเตือนข้อผิดพลาด
4. **ความไม่สอดคล้องของ Prettier**: พบปัญหาการจัดรูปแบบโค้ด (formatting) เล็กน้อยหลังจากการปรับแก้โค้ด

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `backend/src/modules/ai/ai.controller.ts` | นำเข้า `ExecutionProfile` และปรับปรุง `getProductionProfile` ให้ตรวจสอบและจัดประเภท ExecutionProfile อย่างปลอดภัยหลีกเลี่ยงการ cast ตรงๆ |
| `backend/src/modules/ai/tests/ai.controller.spec.ts` | ใช้ generic type parameter ใน `getRequest<T>()` เพื่อระบุประเภทข้อมูลของ `user` อย่างถูกต้องและแก้ไข ESLint warning |
| `specs/88-logs/rollouts.md` | เพิ่มบันทึก rollout ของ Feature-236 |
| `AGENTS.md` | อัปเดตชื่อโมเดลหลักและ OCR ให้ใช้ canonical names (`np-dms-ai:latest` และ `np-dms-ocr:latest`) |

## กฎที่ Lock แล้ว

- **การเข้าถึง Request User ใน Controller tests**: ให้ใช้ generic type parameter ใน `getRequest<{ user: { user_id: number; username: string } }>()` ทุกครั้ง เพื่อความปลอดภัยของไทป์และป้องกัน ESLint warning
- **การแปลง String เป็น Union Type ใน Controller**: ควรใช้การตรวจสอบด้วย runtime array (เช่น `validProfiles.find()`) เพื่อตรวจสอบขอบเขตและจัดกลุ่มประเภทข้อมูล แทนการบังคับแคสต์ตรง ๆ (`as UnionType`)

## Verification

- **Backend compilation**: ✅ `npx tsc --noEmit` ผ่านด้วย 0 errors
- **Backend linting**: ✅ `npm run lint` ผ่านด้วย 0 errors / warnings
- **Frontend compilation**: ✅ `npx tsc --noEmit` ผ่านด้วย 0 errors
- **Frontend linting**: ✅ `npm run lint` ผ่านด้วย 0 errors / warnings
- **Automated Tests**: ✅ Jest tests ผ่าน 256/256 ตัวสำเร็จ 100%
