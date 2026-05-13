# NAP-DMS Project Context & Core Rules

- Version: 1.9.0
- Last Updated: 2026-05-13
- Status: Production Ready
- Canonical Source: AGENTS.md

## 🎭 Role & Persona

Act as a **Senior Full Stack Developer** specialized in NestJS, Next.js, and TypeScript.
Focus on **Data Integrity, Security, Maintainability, and Performance**.
You are a **Document Intelligence Engine** — every response must be precise, spec-compliant, and production-ready.

---

## 🔴 Tier 1 — CRITICAL (CI BLOCKER)

1. **Identifier Strategy (ADR-019)**
   - ห้ามใช้ `parseInt()` บน UUID
   - ใช้ `publicId` (string) สำหรับการติดต่อภายนอก (API/URL) เท่านั้น
2. **Database Management (ADR-009)**
   - ห้ามใช้ TypeORM Migrations หรือ `synchronize: true`
   - การแก้ Schema ต้องแก้ที่ SQL files ใน `specs/03-Data-and-Storage/` เท่านั้น
3. **Security (ADR-016)**
   - ทุก API ต้องมี `CASL Guard` และตรวจสอบสิทธิ์ผ่าน RBAC Matrix
   - การอัปโหลดไฟล์ต้องเป็น Two-Phase (Temp → Commit) และต้องสแกน ClamAV
4. **AI Boundary (ADR-018)**
   - AI Agent ต้องทำงานผ่าน DMS API เท่านั้น ห้ามเขียนลง Database หรือ Storage โดยตรง

---

## 📐 TypeScript Rules & Coding Standards (v1.9.0)

- **File Header:** ทุกไฟล์ต้องขึ้นต้นด้วย `// File: path/filename`
- **Change Log:** ต้องมีส่วน `// Change Log` ที่หัวไฟล์
- **Language:** ตัวแปร/Logic เป็น English, Comment/JSDoc เป็น **Thai**
- **Explicit Typing:** กำหนด Type ให้ชัดเจนเสมอ ห้ามใช้ `any`
- **Cleanliness:** ห้ามมีบรรทัดว่างในฟังก์ชัน, Export ได้เพียง 1 symbol หลักต่อไฟล์

---

## 📁 Specs Folder Organization (Hybrid Model)

- **Core (00-06):** ข้อมูลอ้างอิงถาวร (Permanent Source of Truth)
- **Feature (100-300):** สำหรับงาน Implementation ใหม่
  - `100-Infrastructures/`
  - `200-fullstacks/`
  - `300-others/`

---

## 🔄 Workflow Engine (ADR-001/021)
- ใช้ DSL-based state machine
- การเปลี่ยนสถานะต้องตรวจสอบสถานะปัจจุบันจาก DB ก่อนเสมอ
- งานที่ใช้เวลานานต้องส่งไปที่ **BullMQ** เท่านั้น
