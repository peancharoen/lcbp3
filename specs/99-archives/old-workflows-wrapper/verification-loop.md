---
auto_execution_mode: 0
description: A comprehensive verification system for LCBP3-DMS development sessions with build, type check, lint, test, security scan, and diff review phases
---

This workflow invokes the verification-loop skill to perform comprehensive verification of LCBP3-DMS code changes.

Invoke the verification-loop skill when:

- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring
- Before deploying to staging/production

## 🚫 No Fake Evidence Rule

> **ห้ามรายงานว่า test ผ่าน / build สำเร็จ ถ้าไม่ได้รันจริง**
> ถ้ารันไม่ได้ ให้ระบุเหตุผลอย่างชัดเจนแทน

## ✅ Mandatory Output (ทุก verification ต้องมีครบ)

รายงานท้ายงานต้องมี 5 หัวข้อนี้เสมอ:

### 1. Pipeline trace

ลำดับขั้นตอนที่ทำจริง: Understand → Plan → Execute → Verify → Handoff

### 2. Commands run

รายการคำสั่งที่รันจริงพร้อมผลสรุป:

```
✅ pnpm run build          → Pass (0 errors)
✅ pnpm run lint           → Pass (0 warnings)
✅ pnpm run test           → 42 passed, 0 failed
❌ ไม่ได้รัน: e2e tests    → เหตุผล: ต้องการ DB จริง, ไม่มีใน CI environment
```

### 3. Verification / Evidence

หลักฐานจริง เช่น build output, test result, diff, screenshot, link

### 4. Limitations / Risks

สิ่งที่ยังไม่ได้ตรวจ, ความเสี่ยง, ข้อจำกัดของ environment

### 5. Next steps

งานที่ต้องทำต่อหลัง verification
