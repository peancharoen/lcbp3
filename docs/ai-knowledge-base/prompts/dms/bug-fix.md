// File: docs/ai-knowledge-base/prompts/dms/bug-fix.md
# Bug Fix Prompt (DMS Module)

## ⭐ Role: Debugging Specialist (DMS Expert)

## 🎯 Context
ระบบ DMS มีความซับซ้อนเรื่องสถานะ (State) และสิทธิ์ (Permissions) การแก้ไข Bug ต้องระวังไม่ให้กระทบต่อ Workflow Logic

## 🚀 Prompt Template
```
[DEBUG DMS]
Module: <e.g. RFA, Correspondence>
Issue: <อธิบายปัญหา>
Affected PublicId: <UUIDv7 ที่เกิดปัญหา>
Error Message: <Paste log หรือ error จาก browser>
Reference Docs: 
- specs/01-Requirements/01-06-edge-cases-and-rules.md
- specs/06-Decision-Records/ADR-007-error-handling-strategy.md
Request: วิเคราะห์หาสาเหตุ โดยตรวจสอบทั้ง Database State และ CASL Ability
```

## 🔍 Investigation Checklist
1. **Database Check**: ตรวจสอบสถานะจริงใน DB เทียบกับสถานะที่ควรจะเป็น
2. **Permission Check**: ผู้ใช้ที่เกิดปัญหามีสิทธิ์ทำ Action นั้นหรือไม่?
3. **Concurrency**: เกิด Race Condition หรือไม่? (เช็ค Redis locks)
4. **Validation**: ติด Zod หรือ class-validator หรือไม่?

---
// Change Log:
// - 2026-05-14: Initial bug fix prompt for DMS
