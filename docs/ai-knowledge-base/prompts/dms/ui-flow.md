// File: docs/ai-knowledge-base/prompts/dms/ui-flow.md
# UI/UX Flow Design Prompt (DMS)

## ⭐ Role: UX/UI Designer (Enterprise Application)

## 🎯 Context
ออกแบบหน้าจอและการไหลเวียนของงาน (User Journey) ในระบบ DMS ที่มีข้อมูลจำนวนมากและ Workflow ที่ซับซ้อน

## 🎨 Design Guidelines
1. **Consistency**: ใช้ Component จาก `shadcn/ui` และ Palette สีตามมาตรฐานโครงการ
2. **Efficiency**: ลดจำนวนการคลิกเพื่อเข้าถึงข้อมูลสำคัญ (e.g. Document Preview)
3. **Feedback**: ต้องมี Loading states, Success/Error toasts และ Skeleton screens
4. **Responsive**: รองรับทั้ง Desktop (หลัก) และ Tablet สำหรับงานหน้าไซต์

## 🚀 Prompt Template
```
[UI FLOW DESIGN]
Feature: <ชื่อฟีเจอร์>
User Role: <e.g. Document Control, Sub-contractor>
Objective: <สิ่งที่ผู้ใช้ต้องการทำ>
Request: ออกแบบ User Flow ตั้งแต่เริ่มต้นจนจบ พร้อมระบุ UI Components ที่ต้องใช้ในแต่ละหน้า
```

---
// Change Log:
// - 2026-05-14: Initial UI flow prompt
