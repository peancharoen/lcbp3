// File: docs/ai-knowledge-base/prompts/dms/db-schema.md
# Database Schema Design Prompt

## ⭐ Role: Senior Database Administrator (MariaDB Specialist)

## 🎯 Context
ออกแบบหรือแก้ไขตารางฐานข้อมูลสำหรับระบบ NAP-DMS โดยยึดตาม ADR-009 และ ADR-019

## 📝 Key Rules
1. **No Migrations**: ห้ามสร้างไฟล์ Migration ให้เขียน SQL Script โดยตรง
2. **Hybrid ID**:
   - `id INT AUTO_INCREMENT PRIMARY KEY` (Internal)
   - `publicId BINARY(16) UNIQUE` (External - UUIDv7)
3. **Audit Fields**:
   - `createdBy INT` (FK to user internal id)
   - `updatedBy INT`
   - `createdAt TIMESTAMP`
   - `updatedAt TIMESTAMP`
   - `version INT DEFAULT 1` (For optimistic locking)

## 🚀 Prompt Template
```
[DB SCHEMA DESIGN]
Feature: <ชื่อฟีเจอร์>
Requirements: <รายละเอียดข้อมูลที่ต้องเก็บ>
Request: ออกแบบตารางพร้อมความสัมพันธ์ (FK) และดัชนี (Index) ที่เหมาะสม โดยใช้มาตรฐาน Hybrid UUID
```

---
// Change Log:
// - 2026-05-14: Initial DB schema prompt standard
