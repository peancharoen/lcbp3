# 🧠 NAP-DMS Agent Skills (v1.9.0)

ไฟล์นี้กำหนดทักษะและความสามารถเฉพาะทางของ Document Intelligence Engine สำหรับโครงการ LCBP3 v1.9.0 เพื่อรักษามาตรฐานสูงสุดด้าน Security และ Data Integrity

**Status**: Production Ready | **Last Updated**: 2026-05-17 | **Total Skills**: 23

> 📌 Shared context for all speckit-\* skills: see [`_LCBP3-CONTEXT.md`](./_LCBP3-CONTEXT.md).

---

## 🏗️ Architectural & Data Integrity

- **Identifier Strategy Mastery (ADR-019 — March 2026):**
  - บังคับใช้ **UUIDv7** เป็น Public ID; entity สืบทอดจาก `UuidBaseEntity` และเปิด `publicId` **ตรงๆ** (ห้ามใช้ `@Expose({ name: 'id' })` rename)
  - ตรวจสอบและป้องกันการใช้ `parseInt()`, `Number()`, หรือ `+` กับ UUID ทั้ง backend/frontend
  - ตรวจสอบว่า Entity มีการใช้ `@Exclude()` บน Primary Key `INT AUTO_INCREMENT` เพื่อไม่ให้หลุดออกไปยัง API
  - Frontend ใช้ `publicId` ตรงๆ — **ห้าม** `id ?? ''` fallback หรือมี `uuid?: string` คู่กับ `publicId` ใน interface
- **Strict Validation Engine:**
  - บังคับใช้ **Zod** สำหรับการทำ Form Validation ฝั่ง Frontend
  - บังคับใช้ **class-validator** สำหรับ Backend DTOs
  - ตรวจสอบการส่ง **Idempotency-Key** ใน Header สำหรับทุก Mutation Request (POST/PUT/PATCH)

## ⚙️ Workflow & Concurrency Control

- **DMS Workflow Engine Proficiency:**
  - มีความเชี่ยวชาญใน **DSL-based state machines**; ตรวจสอบทุกการเปลี่ยนสถานะเอกสารเทียบกับกฎใน DSL Parser เสมอ
  - ป้องกันการอนุมัติซ้ำซ้อนโดยการตรวจสอบสถานะปัจจุบันจากฐานข้อมูลก่อนเริ่ม Logic การเปลี่ยน State ทุกครั้ง
- **Collision-Free Numbering (ADR-002):**
  - ใช้ทักษะการทำ **Distributed Locking** ผ่าน **Redis Redlock** ร่วมกับ TypeORM `@VersionColumn` สำหรับการเจนเลขที่เอกสาร (Document Numbering)
  - ห้ามเจนเลขโดยใช้ Logic ฝั่ง Application เพียงอย่างเดียวเด็ดขาด
- **Asynchronous Task Orchestration (ADR-008):**
  - แยกงานที่ใช้เวลานาน (เช่น การส่ง Notification, การทำ Correspondence Routing) ไปทำที่ **BullMQ** เท่านั้น

## 🛡️ Security & Integrity Audit

- **RBAC Matrix Enforcement (ADR-016):**
  - บังคับใช้ **JwtAuthGuard**, **RolesGuard** และ **CASL AbilityFactory** ในทุก Controller ใหม่
  - ตรวจสอบการมีอยู่ของ `AuditLogInterceptor` สำหรับทุก API ที่มีการเปลี่ยนแปลงข้อมูล
- **Secure File Lifecycle:**
  - ใช้ Logic **Two-Phase Upload**: Upload → Temp → ClamAV Scan → Commit → Permanent
  - บังคับใช้ Whitelist File Extension และ Max Size 50MB ตามที่กำหนดใน ADR-016

## 🤖 AI Boundary & Privacy (ADR-018/020)

- **Data Isolation:**
  - รับรองว่าฟีเจอร์ AI จะรันผ่าน **Ollama (On-premises)** เท่านั้น และไม่ส่งข้อมูลออกนอกเน็ตเวิร์ก
  - AI จะเข้าถึงข้อมูลผ่าน **DMS API** เท่านั้น (ห้ามต่อ Database หรือ Storage โดยตรง)
- **Human-in-the-loop Validation:**
  - ออกแบบให้ผลลัพธ์จาก AI (เช่น การดึง Metadata เอกสาร) ต้องผ่านการยืนยันจาก User ก่อนบันทึกลงระบบเสมอ

## 🏷️ Domain Terminology Consistency

- **Term Correction:** แก้ไขคำศัพท์ให้ถูกต้องตาม Glossary ทันที (เช่น เปลี่ยน Letter เป็น **Correspondence**, Approval Flow เป็น **Workflow Engine**)
- **i18n Guidelines:** ห้ามเขียน Thai/English String ลงใน Component โดยตรง ต้องใช้ i18n Keys เท่านั้น

---

## 🔄 Skill Dependency Matrix

| Skill                      | Dependencies         | Handoffs To                              | Notes                         |
| -------------------------- | -------------------- | ---------------------------------------- | ----------------------------- |
| **speckit-constitution**   | None                 | speckit-specify                          | Project governance foundation |
| **speckit-specify**        | speckit-constitution | speckit-clarify                          | Feature specification         |
| **speckit-clarify**        | speckit-specify      | speckit-plan                             | Resolve ambiguities           |
| **speckit-plan**           | speckit-clarify      | speckit-tasks, speckit-checklist         | Technical design              |
| **speckit-tasks**          | speckit-plan         | speckit-implement                        | Task breakdown                |
| **speckit-implement**      | speckit-tasks        | speckit-checker                          | Code implementation           |
| **speckit-checker**        | speckit-implement    | speckit-tester                           | Static analysis               |
| **speckit-tester**         | speckit-checker      | speckit-reviewer                         | Test execution                |
| **speckit-reviewer**       | speckit-tester       | speckit-validate                         | Code review                   |
| **speckit-validate**       | speckit-reviewer     | None                                     | Requirements validation       |
| **speckit-analyze**        | speckit-tasks        | None                                     | Cross-artifact consistency    |
| **speckit-migrate**        | None                 | speckit-plan                             | Legacy code import            |
| **speckit-quizme**         | speckit-specify      | speckit-plan                             | Logic validation              |
| **speckit-diff**           | None                 | speckit-plan                             | Version comparison            |
| **speckit-status**         | None                 | None                                     | Progress tracking             |
| **speckit-taskstoissues**  | speckit-tasks        | None                                     | Issue sync                    |
| **speckit-checklist**      | speckit-plan         | None                                     | Requirements validation       |
| **nestjs-best-practices**  | None                 | speckit-implement                        | Backend patterns              |
| **next-best-practices**    | None                 | speckit-implement                        | Frontend patterns             |
| **speckit-security-audit** | None                 | speckit-reviewer                         | Security validation           |
| **e2e-testing**            | None                 | speckit-tester                           | Playwright E2E patterns       |
| **verification-loop**      | None                 | speckit-checker, speckit-tester          | Comprehensive verification    |
| **security-review**        | None                 | speckit-reviewer, speckit-security-audit | OWASP Top 10 + ADR compliance |

---

## 🛠️ Skill Health Monitoring

### Health Check Scripts (from repo root)

- **Bash**: `./.agents/scripts/bash/audit-skills.sh` - Comprehensive skill health audit
- **PowerShell**: `./.agents/scripts/powershell/audit-skills.ps1` - Windows equivalent

### Validation Scripts

- **Version Check**: `./.agents/scripts/bash/validate-versions.sh` - Ensure version consistency
- **Workflow Sync**: `./.agents/scripts/bash/sync-workflows.sh` - Verify workflow integration

### Health Metrics

- **Total Skills**: 23 implemented
- **Version Alignment**: v1.9.0 across all skills
- **Template Coverage**: 100% for skills requiring templates
- **Documentation**: Complete front matter + shared `_LCBP3-CONTEXT.md` appendix

### Maintenance Schedule

- **Daily**: Run `audit-skills.sh` for health monitoring
- **Weekly**: Run `validate-versions.sh` for version consistency
- **Monthly**: Review skill dependencies and update documentation
