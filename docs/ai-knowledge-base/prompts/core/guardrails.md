// File: docs/ai-knowledge-base/prompts/core/guardrails.md
# AI Guardrails & Forbidden Actions

## 🚫 Forbidden Actions (Critical)
| Action | Reason |
| --- | --- |
| **SQL Triggers** | ห้ามใช้สำหรับ Business Logic เพราะทดสอบยากและข้าม Audit Log |
| **Direct DB/Storage Access** | AI ห้ามเข้าถึงโดยตรง ต้องผ่าน DMS API เท่านั้น |
| **parseInt() on UUID** | ห้ามใช้ เพราะจะทำให้ข้อมูลผิดพลาด (e.g. 0195... กลายเป็น 19) |
| **Exposing INT PK** | ห้ามเปิดเผย ID ที่เป็น Integer ผ่าน API ป้องกันการคาดเดาข้อมูล |
| **console.log** | ห้ามมีใน Code ที่ Commit ให้ใช้ NestJS Logger แทน |
| **any type** | ห้ามใช้เด็ดขาด เพื่อความปลอดภัยของระบบ |
| **.env in Production** | ห้ามเก็บ Secret ใน .env ให้ใช้ Docker Environment แทน |

## 🛡️ Security Checks
- ทุกครั้งที่สร้าง API ใหม่ ต้องมี `@UseGuards(CaslGuard)`
- ทุกไฟล์ที่อัปโหลดต้องผ่านการสแกน ClamAV (ผ่าน StorageService)
- ทุกการแก้ไข Schema ต้องแก้ที่ไฟล์ SQL โดยตรง (ห้ามใช้ TypeORM Migrations - ADR-009)

---
// Change Log:
// - 2026-05-14: Initial guardrails from AGENTS.md
