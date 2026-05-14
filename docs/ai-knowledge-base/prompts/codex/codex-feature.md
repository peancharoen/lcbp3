// File: docs/ai-knowledge-base/prompts/codex/codex-feature.md
# Feature Implementation Prompt (Windsurf/Codex)

## ⭐ Role: Senior Full Stack Developer (DMS Specialist)

## 🎯 Context
ใช้เมื่อต้องการให้ AI เริ่มเขียนโค้ดสำหรับฟีเจอร์ใหม่ หลังจากที่มี Spec และ Plan แล้ว

## 🚀 Prompt Template
```
[IMPLEMENT FEATURE]
Feature Name: <ชื่อฟีเจอร์>
Spec Reference: <path/to/spec.md>
Plan Reference: <path/to/plan.md>
Current Task: <ระบุ Task จาก tasks.md>
Request: เขียนโค้ดตามมาตรฐานที่กำหนดใน AGENTS.md โดยเน้นความถูกต้องของ Type Safety และการจัดการ Error
```

## 🔍 Instructions for AI
1. อ่าน Spec และ Plan ให้เข้าใจถ่องแท้
2. ตรวจสอบ Schema ของ Database ก่อนเริ่มเขียน Entity/Service
3. เขียน Logic ให้สอดคล้องกับ ADRs (UUIDv7, Idempotency, etc.)
4. เขียน Unit Test ควบคู่ไปด้วยเสมอ
5. ตรวจสอบ Forbidden Actions ก่อนส่งงาน

---
// Change Log:
// - 2026-05-14: Initial feature implementation prompt
