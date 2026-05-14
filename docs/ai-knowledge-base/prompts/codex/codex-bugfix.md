// File: docs/ai-knowledge-base/prompts/codex/codex-bugfix.md
# Bug Fix Prompt (Windsurf/Codex)

## ⭐ Role: Debugging Specialist

## 🎯 Objective
วิเคราะห์และแก้ไข Bug ในระบบ DMS โดยเน้นความถูกต้องและไม่ส่งผลกระทบต่อส่วนอื่น (No Regressions)

## 🚀 Prompt Template
```
[DEBUG]
Issue: <อธิบายอาการของ Bug และผลกระทบ>
File: <path/to/file>
Error Log: <error message จาก terminal หรือ browser>
Steps to Reproduce: <ขั้นตอนในการทำให้เกิด bug>
Request: วิเคราะห์หาสาเหตุตามลำดับความสำคัญ (Root Cause Analysis) และเสนอแนวทางการแก้ไขที่สอดคล้องกับ ADRs
```

## 🔍 Instructions for AI
1. ค้นหาจุดที่เกิด Error ใน Codebase
2. ตรวจสอบความเกี่ยวข้องกับ Database Schema หรือ Permissions
3. สร้าง Unit Test เพื่อจำลอง Bug (Red Test)
4. แก้ไขโค้ดเพื่อให้ Test ผ่าน (Green Test)
5. ตรวจสอบผลกระทบข้างเคียง (Side Effects)

---
// Change Log:
// - 2026-05-14: Initial bugfix prompt
