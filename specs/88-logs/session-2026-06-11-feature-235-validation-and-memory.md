# Session 18 — 2026-06-11 (Feature-235 Validation & Memory Save)

## Summary

สรุปผล validation ของ Feature-235, บันทึกรายงาน `validation-report.md`, และสร้าง cutover checklist สำหรับปิด T032 / sidecar pytest โดยยึด contract ปัจจุบันของ `/api/ai/jobs` ที่เป็น Option B.

## ปัญหาที่พบ (Root Cause)

| ปัญหา | สาเหตุ | การแก้ไข |
|---|---|---|
| Validation ยังไม่ขึ้น `PASS` | ยังขาด manual Gate 1–4 และ sidecar pytest ใน environment จริง | สร้าง `checklists/cutover-validation.md` เพื่อใช้ปิดงานอย่างเป็นระบบ |
| `quickstart.md` เดิมไม่สอดคล้องกับ contract ปัจจุบัน | ตัวอย่างเก่ายังส่ง `executionProfile` / `large-context` จาก caller | เก็บ evidence ใน validation report และทำ checklist ใหม่ตาม implementation ปัจจุบัน |
| Project memory ยังสะท้อน test count เก่า | รอบ verification ล่าสุดได้ targeted tests 27/27 แล้ว | อัปเดต `memory/project-memory-override.md` ให้ตรงกับสถานะล่าสุด |

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `specs/200-fullstacks/235-ai-runtime-policy-refactor/validation-report.md` | บันทึกผล validation เป็น `PARTIAL` พร้อม requirement matrix, gaps, และ recommendations |
| `specs/200-fullstacks/235-ai-runtime-policy-refactor/checklists/cutover-validation.md` | สร้าง runbook สำหรับ T032, backend tests, backend build, และ sidecar pytest |
| `specs/88-logs/rollouts.md` | เพิ่ม entry สำหรับ validation follow-up ของ Feature-235 |
| `memory/project-memory-override.md` | อัปเดตสถานะ Feature-235, test count ล่าสุด, และชี้ไปยัง cutover checklist |

## กฎที่ Lock แล้ว

- ใช้ `checklists/cutover-validation.md` เป็น runbook หลักสำหรับปิด T032
- Validation target ของ `/api/ai/jobs` ต้องยึด Option B ปัจจุบัน ไม่ใช้ caller-driven `executionProfile`
- ถ้าต้องบันทึกผล verification ต่อ ให้แนบ evidence จริงจาก backend / sidecar environment

## Verification

- [x] `pnpm --filter backend test -- --runInBand --testPathPatterns="ai.service.spec.ts|queue-policy.spec.ts|ai.controller.spec.ts"` = 27/27 ผ่าน
- [x] `pnpm --filter backend build` = ผ่าน
- [x] `validation-report.md` ถูกสร้างและเก็บผลว่า `PARTIAL`
- [x] `cutover-validation.md` ถูกสร้างเพื่อใช้ปิด T032
