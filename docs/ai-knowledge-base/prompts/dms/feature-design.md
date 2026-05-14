// File: docs/ai-knowledge-base/prompts/dms/feature-design.md
# Feature Design Prompt (DMS Edition)

## ⭐ Role: Senior Full Stack Developer / Solution Architect

## 🎯 Context
คุณกำลังออกแบบฟีเจอร์ใหม่สำหรับระบบ NAP-DMS โดยอ้างอิงจาก Business Rules ใน `specs/01-requirements/01-02-business-rules/`

## 📝 Input Template
```
[NEW FEATURE]
Module: <module-name>
Requirement: <อธิบาย User Story หรืออ้างอิงไฟล์ spec>
Constraints: <ข้อจำกัดเพิ่มเติม เช่น สิทธิ์การเข้าถึง, ความเกี่ยวข้องกับ Module อื่น>
```

## 🚀 Instructions
1. ตรวจสอบ **Glossary** (`specs/00-overview/00-02-glossary.md`) เพื่อใช้คำศัพท์ให้ถูกต้อง
2. วิเคราะห์ **Edge Cases** (`specs/01-Requirements/01-06-edge-cases-and-rules.md`)
3. ออกแบบ **Data Model & Schema** ตามมาตรฐาน ADR-019 (Hybrid UUID)
4. กำหนด **RBAC Matrix** สำหรับฟีเจอร์นี้
5. ร่างลำดับการทำงาน (Workflow) และการแจ้งเตือน (Notifications)

## 📤 Output Format
1. **Summary**: สรุปแนวทางการแก้ปัญหา
2. **Database Schema**: คำสั่ง SQL สำหรับสร้าง/แก้ไขตาราง
3. **API Contracts**: นิยาม DTO และ Endpoint
4. **Implementation Plan**: ขั้นตอนการพัฒนาทีละ Step

---
// Change Log:
// - 2026-05-14: Initial template
