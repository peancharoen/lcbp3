// File: docs/ai-knowledge-base/prompts/dms/refactor.md
# Code Refactoring Prompt (DMS Standard)

## ⭐ Role: Senior Software Engineer (Refactoring Specialist)

## 🎯 Objective
ปรับปรุงโครงสร้างโค้ดให้สะอาด (Clean Code), บำรุงรักษาง่าย (Maintainability) และสอดคล้องกับมาตรฐาน LCBP3

## 🏗️ Refactoring Principles
1. **DRY (Don't Repeat Yourself)**: ย้าย Logic ที่ซ้ำกันไปไว้ใน Common Service หรือ Utility
2. **SOLID**: แยกความรับผิดชอบของ Class และ Method ให้ชัดเจน
3. **Type Safety**: กำจัด `any` และ `unknown` โดยใช้ Interface/Type ที่ถูกต้อง
4. **Performance**: ลดการ Query ซ้ำซ้อน และใช้ Transaction เมื่อจำเป็น

## 🚀 Prompt Template
```
[REFACTOR]
Target File: <path/to/file>
Goal: <e.g. แยก logic ออกจาก controller, ปรับปรุง type safety>
Request: ช่วยวิเคราะห์โค้ดเดิมและเสนอเวอร์ชัน Refactor ที่ยังคงรักษา functionality เดิมไว้ 100% พร้อมอธิบายเหตุผลของการเปลี่ยนแปลง
```

---
// Change Log:
// - 2026-05-14: Initial refactor prompt
