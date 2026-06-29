// File: docs/ai-knowledge-base/prompts/core/coding-standards.md
# Coding Standards & Best Practices

## ✅ General Guidelines
- **English for Code**: ใช้ภาษาอังกฤษสำหรับตัวแปร, ชื่อฟังก์ชัน และ logic
- **Thai for Comments**: ใช้ภาษาไทยสำหรับการอธิบาย code, JSDoc และ Documentation
- **Strict Typing**: ห้ามใช้ `any` เด็ดขาด ให้ใช้ Interface หรือ Type เสมอ
- **Single Export**: 1 ไฟล์ควร Export เพียง 1 สัญลักษณ์หลัก
- **File Headers**: ทุกไฟล์ต้องมี `// File: path` และ `// Change Log`

## 🆔 Identifier Strategy (ADR-019)
- **Database PK**: ใช้ `INT AUTO_INCREMENT` (ห้ามเปิดเผยผ่าน API)
- **Public ID**: ใช้ `UUIDv7` สำหรับการอ้างอิงผ่าน API และ URL เท่านั้น
- **Frontend**: ใช้ `publicId` เพียงอย่างเดียว ห้ามใช้ `parseInt()` กับ UUID

## 🛡️ Security & Integrity
- **Idempotency**: ทุกการเขียนข้อมูล (POST/PUT/PATCH) ต้องรองรับ `Idempotency-Key`
- **RBAC**: ตรวจสอบสิทธิ์ผ่าน CASL Guard เสมอ
- **Data Isolation**: AI ห้ามเข้าถึง Database โดยตรง ต้องผ่าน API เท่านั้น
- **Validation**: ใช้ Zod (Frontend) และ class-validator (Backend)

## 🏗️ Architecture
- **Backend**: Thin Controller -> Service (Business Logic) -> Repository/Entity
- **Frontend**: ใช้ Component จาก shadcn/ui และจัดการ State ด้วย TanStack Query
- **Async Tasks**: งานที่ใช้เวลานานต้องส่งเข้า BullMQ เสมอ

---
// Change Log:
// - 2026-05-14: Consolidated coding standards from AGENTS.md
