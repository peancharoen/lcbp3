// File: docs/ai-knowledge-base/prompts/core/system-context.md
# System Context: NAP-DMS (LCBP3)

## 🏗️ Project Overview
NAP-DMS คือระบบจัดการเอกสาร (Document Management System) สำหรับโครงการก่อสร้างขนาดใหญ่ (LCBP3) โดยเน้นไปที่การควบคุมเอกสาร (Document Control), การจัดการแบบวาด (Drawing Management), และการไหลเวียนของเอกสารขออนุมัติ (RFA/Transmittal/Circulation)

## 🎯 Key Modules
1. **Correspondence**: การจัดการจดหมายโต้ตอบระหว่างหน่วยงาน
2. **RFA (Request for Approval)**: กระบวนการขออนุมัติวัสดุ/แบบวาด
3. **Transmittal**: การส่งมอบเอกสารอย่างเป็นทางการ
4. **Circulation**: การกระจายเอกสารภายในทีม
5. **AI Intelligence**: การใช้ AI ในการจำแนกเอกสาร (Classification), สกัดข้อมูล (Extraction), และค้นหา (Semantic Search)

## 🔑 Technology Stack
- **Backend**: NestJS, TypeScript, MariaDB (SQL), Redis (Redlock/BullMQ)
- **Frontend**: Next.js (App Router), TanStack Query, React Hook Form, Zod, shadcn/ui
- **AI**: Ollama (On-premises), Gemini (via API for non-sensitive tasks)
- **Infrastructure**: Docker, Gitea Actions, QNAP Container Station

---
// Change Log:
// - 2026-05-14: Initial project context
