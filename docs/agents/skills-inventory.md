# 📚 NAP-DMS LCBP3 Agent Skills — Categorization & Inventory Catalog

**Version:** 1.9.0 | **Last Synced:** 2026-08-03 | **Total Skills:** 35 | **Architecture:** LCBP3-DMS

เอกสารนี้รวบรวมและจัดหมวดหมู่ชุดทักษะ Agent ทั้งหมด 35 ตัวใน `.agents/skills/` สำหรับ **Google Antigravity IDE**, **Devin**, **Claude Code**, **Windsurf Cascade**, **Codex CLI** และระบบที่รองรับ `AGENTS.md`

---

## 🗂️ 1. โครงสร้างการจัดหมวดหมู่ (Skill Classification Taxonomy)

```
.agents/skills/
├── 1. Speckit Core Pipeline (00-112)       ── 14 Skills: วงจรพัฒนาฟีเจอร์หลัก (Specify → Validate)
├── 2. Speckit Utility & Tracking (201-206) ──  6 Skills: เครื่องมือเสริมและติดตามสถานะ
├── 3. LCBP3 Architecture & Engineering    ── 10 Skills: กฎสถาปัตยกรรม, Scaffolding, การทดสอบ, Security & Deploy
├── 4. Diagnostics, Recovery & Workflow     ──  5 Skills: การวิเคราะห์ปัญหา, แก้บั๊ก, สานต่องาน, จดจำ Context
└── 5. Shared Foundations & Contracts      ──  4 Core Files: Versioning, Shared Context, Work Contracts
```

---

## 🚀 2. รายละเอียดทักษะรายหมวดหมู่ (Detailed Skill Catalog)

### 1️⃣ หมวดหมู่ที่ 1: Speckit Core Pipeline (Feature Specification & Development Lifecycle)
วงจรพัฒนาฟีเจอร์แบบ End-to-End ตามหลักการ Spec-Driven Development

| Skill Name | Version | Scope / Purpose | Dependencies | Handoffs To |
| :--- | :---: | :--- | :--- | :--- |
| [`00-speckit-all`](file:///opt/np-dms-lcbp3/.agents/skills/00-speckit-all/SKILL.md) | `1.9.0` | รันทั้ง pipeline ตั้งแต่ Specify จนถึง Validate ในคำสั่งเดียว | None | None |
| [`01-speckit-prepare`](file:///opt/np-dms-lcbp3/.agents/skills/01-speckit-prepare/SKILL.md) | `1.9.0` | รันขั้นตอนเตรียมงาน (Specify → Clarify → Plan → Tasks → Analyze) | None | `107-speckit-implement` |
| [`101-speckit-constitution`](file:///opt/np-dms-lcbp3/.agents/skills/101-speckit-constitution/SKILL.md) | `1.9.0` | กำหนด/อัปเดต Project Constitution, Vision, Guardrails และหลักการทำงาน | None | `102-speckit-specify` |
| [`102-speckit-specify`](file:///opt/np-dms-lcbp3/.agents/skills/102-speckit-specify/SKILL.md) | `1.9.0` | แปลง Requirement ภาษาธรรมชาติเป็น `spec.md` ตามมาตรฐาน LCBP3 | `101-speckit-constitution` | `103-speckit-clarify` |
| [`103-speckit-clarify`](file:///opt/np-dms-lcbp3/.agents/skills/103-speckit-clarify/SKILL.md) | `1.9.0` | วิเคราะห์หาจุดคลุมเครือ และถามคำถามชี้ชัดไม่เกิน 5 ข้อเพื่ออัปเดตลง `spec.md` | `102-speckit-specify` | `104-speckit-plan` |
| [`104-speckit-plan`](file:///opt/np-dms-lcbp3/.agents/skills/104-speckit-plan/SKILL.md) | `1.9.0` | วางแผนสถาปัตยกรรม ออกแบบ Data Model, API Contract และแผนการแก้ไขไฟล์ | `103-speckit-clarify` | `105-speckit-tasks`, `205-speckit-checklist` |
| [`105-speckit-tasks`](file:///opt/np-dms-lcbp3/.agents/skills/105-speckit-tasks/SKILL.md) | `1.9.0` | แตกรายละเอียดงานลง `tasks.md` เรียงตาม Dependency และ Blast Radius | `104-speckit-plan` | `107-speckit-implement` |
| [`106-speckit-analyze`](file:///opt/np-dms-lcbp3/.agents/skills/106-speckit-analyze/SKILL.md) | `1.9.0` | ตรวจสอบความสอดคล้องข้ามเอกสาร (Consistency: spec vs plan vs tasks) แบบ Read-only | `105-speckit-tasks` | None |
| [`107-speckit-implement`](file:///opt/np-dms-lcbp3/.agents/skills/107-speckit-implement/SKILL.md) | `1.9.0` | ลงมือเขียนโค้ดตาม Task โดยบังคับใช้ Ironclad Protocols (TDD, Blast Radius, Strangler) | `105-speckit-tasks` | `108-speckit-checker` |
| [`108-speckit-checker`](file:///opt/np-dms-lcbp3/.agents/skills/108-speckit-checker/SKILL.md) | `1.9.0` | รัน Static Analysis Tools (TypeScript check, ESLint, Markdown-lint) | `107-speckit-implement` | `109-speckit-tester` |
| [`109-speckit-tester`](file:///opt/np-dms-lcbp3/.agents/skills/109-speckit-tester/SKILL.md) | `1.9.0` | รัน Test Suite และคุมเกณฑ์ Coverage (Backend overall 70%+, Business logic 80%+) | `108-speckit-checker` | `110-speckit-reviewer` |
| [`110-speckit-reviewer`](file:///opt/np-dms-lcbp3/.agents/skills/110-speckit-reviewer/SKILL.md) | `1.9.0` | ทำ Code Review โดยแบ่งระดับ Tier 1 (CI Blocker), Tier 2 (Review), Tier 3 (Domain) | `109-speckit-tester` | `111-speckit-validate` |
| [`111-speckit-validate`](file:///opt/np-dms-lcbp3/.agents/skills/111-speckit-validate/SKILL.md) | `1.9.0` | ตรวจสอบการทำงานจริงเทียบกับ Acceptance Criteria และเงื่อนไข UAT | `110-speckit-reviewer` | None |
| [`112-speckit-security-audit`](file:///opt/np-dms-lcbp3/.agents/skills/112-speckit-security-audit/SKILL.md) | `1.9.0` | ตรวจสอบความปลอดภัยตาม OWASP Top 10, CASL Authorization, Two-Phase ClamAV | None | `110-speckit-reviewer` |

---

### 2️⃣ หมวดหมู่ที่ 2: Speckit Utility & Tracking (เครื่องมือเสริมและติดตามสถานะ)
ทักษะสนับสนุนการจัดการ Lifecycle ของ Spec และการเชื่อมต่อกับ Issue Tracker

| Skill Name | Version | Scope / Purpose | Dependencies | Handoffs To |
| :--- | :---: | :--- | :--- | :--- |
| [`201-speckit-status`](file:///opt/np-dms-lcbp3/.agents/skills/201-speckit-status/SKILL.md) | `1.9.0` | แสดง Dashboard สถานะความคืบหน้าของฟีเจอร์ เปอร์เซ็นต์ความสำเร็จ และ Blockers | None | None |
| [`202-speckit-diff`](file:///opt/np-dms-lcbp3/.agents/skills/202-speckit-diff/SKILL.md) | `1.9.0` | เปรียบเทียบความแตกต่าง (Diff) ระหว่างเวอร์ชันของ Spec หรือ Plan เพื่อดูจุดเปลี่ยน | None | `104-speckit-plan` |
| [`203-speckit-migrate`](file:///opt/np-dms-lcbp3/.agents/skills/203-speckit-migrate/SKILL.md) | `1.9.0` | นำเข้าโค้ดเก่า (Legacy codebase) แปลงโครงสร้างและสร้าง spec/plan/tasks เข้าสู่ระบบ | None | `104-speckit-plan` |
| [`204-speckit-quizme`](file:///opt/np-dms-lcbp3/.agents/skills/204-speckit-quizme/SKILL.md) | `1.9.0` | ท้าทาย Spec ด้วย Socratic Method เพื่อค้นหาช่องโหว่ทางตรรกะและ Unhandled Edge Cases | `102-speckit-specify` | `104-speckit-plan` |
| [`205-speckit-checklist`](file:///opt/np-dms-lcbp3/.agents/skills/205-speckit-checklist/SKILL.md) | `1.9.0` | เจน Custom Checklist สำหรับตรวจสอบความสมบูรณ์ของฟีเจอร์ตามความต้องการเฉพาะ | `104-speckit-plan` | None |
| [`206-speckit-taskstoissues`](file:///opt/np-dms-lcbp3/.agents/skills/206-speckit-taskstoissues/SKILL.md) | `1.9.0` | แปลง Task จาก `tasks.md` เป็น Gitea / GitHub Issues พร้อมเรียงลำดับ Dependency | `105-speckit-tasks` | None |

---

### 3️⃣ หมวดหมู่ที่ 3: LCBP3 Architecture & Engineering (กฎสถาปัตยกรรมและเครื่องมือสร้างระบบ)
ทักษะบังคับใช้กฎ สถาปัตยกรรม Scaffolding และการทดสอบระดับ Production

| Skill Name | Version | Scope / Purpose | Dependencies | Handoffs To |
| :--- | :---: | :--- | :--- | :--- |
| [`nestjs-best-practices`](file:///opt/np-dms-lcbp3/.agents/skills/nestjs-best-practices/SKILL.md) | `1.9.0` | กฎสถาปัตยกรรม Backend NestJS 11 (40 กฎ): ADR-019 UUIDv7, ADR-016 CASL, ADR-044 SQL | None | `107-speckit-implement` |
| [`next-best-practices`](file:///opt/np-dms-lcbp3/.agents/skills/next-best-practices/SKILL.md) | `1.9.0` | มาตรฐาน Next.js 15+ App Router, TanStack Query, Zod validation, shadcn/ui, i18n | None | `107-speckit-implement` |
| [`create-backend-module`](file:///opt/np-dms-lcbp3/.agents/skills/create-backend-module/SKILL.md) | `1.9.0` | สร้าง NestJS Feature Module มาตรฐาน (Entity, DTO, Service, Controller, Tests) | None | `108-speckit-checker` |
| [`create-frontend-page`](file:///opt/np-dms-lcbp3/.agents/skills/create-frontend-page/SKILL.md) | `1.9.0` | สร้าง Next.js App Router Page พร้อม Layout, Component, Client Hook, Server Action | None | `108-speckit-checker` |
| [`schema-change`](file:///opt/np-dms-lcbp3/.agents/skills/schema-change/SKILL.md) | `1.9.0` | จัดการปรับปรุง Database Schema ตาม ADR-044 (แก้ไข SQL โดยตรง + Delta Scripts) | None | `107-speckit-implement` |
| [`e2e-testing`](file:///opt/np-dms-lcbp3/.agents/skills/e2e-testing/SKILL.md) | `1.9.0` | Playwright E2E Testing: Page Object Model (POM), Anti-flakiness, Test Artifacts | None | `109-speckit-tester` |
| [`security-review`](file:///opt/np-dms-lcbp3/.agents/skills/security-review/SKILL.md) | `1.9.0` | ตรวจสอบความปลอดภัยระดับระบบ: OWASP Top 10, Role Matrix, Token Expiry, ClamAV | None | `110-speckit-reviewer` |
| [`verification-loop`](file:///opt/np-dms-lcbp3/.agents/skills/verification-loop/SKILL.md) | `1.9.0` | ลูปการตรวจสอบ 6 ขั้นตอน: Build → TypeCheck → Lint → Test → Security → Diff | None | `108-speckit-checker` |
| [`check-real-app`](file:///opt/np-dms-lcbp3/.agents/skills/check-real-app/SKILL.md) | `1.9.0` | ตรวจสอบแอปพลิเคชันที่ Deploy จริงผ่าน Browser: UI, Network Traffic, Console errors | `deploy` | None |
| [`deploy`](file:///opt/np-dms-lcbp3/.agents/skills/deploy/SKILL.md) | `1.9.0` | Deploy ผ่าน Gitea Actions CI/CD Pipeline ไปยัง QNAP Container Station | `verification-loop` | `check-real-app` |

---

### 4️⃣ หมวดหมู่ที่ 4: Diagnostics, Recovery & Workflow (การวิเคราะห์ปัญหาและการทำงานต่อเนื่อง)
ทักษะสำหรับการสืบค้นปัญหาลึก การแก้บั๊กตรงจุด และการจัดการ Context ข้ามเซสชัน

| Skill Name | Version | Scope / Purpose | Dependencies | Handoffs To |
| :--- | :---: | :--- | :--- | :--- |
| [`bugfix`](file:///opt/np-dms-lcbp3/.agents/skills/bugfix/SKILL.md) | `1.9.0` | กระบวนการแก้บั๊กแบบ Surgical Fix ตรงจุด โดยไม่แก้โค้ดส่วนอื่นเกินจำเป็น | None | `verification-loop` |
| [`diagnose`](file:///opt/np-dms-lcbp3/.agents/skills/diagnose/SKILL.md) | `1.9.0` | ลูปการวินิจฉัยปัญหาเชิงลึก: Reproduce → Minimise → Hypothesise → Instrument → Fix | None | `bugfix`, `107-speckit-implement` |
| [`grill-with-docs`](file:///opt/np-dms-lcbp3/.agents/skills/grill-with-docs/SKILL.md) | `1.9.0` | Grilling Session ท้าทายแผนงานเทียบกับ Domain Glossary และ ADRs พร้อมอัปเดตเอกสาร | None | `104-speckit-plan` |
| [`resume-pending-work`](file:///opt/np-dms-lcbp3/.agents/skills/resume-pending-work/SKILL.md) | `1.9.0` | สานต่องานข้าม Session: อ่าน Context เดิม, หา Checkpoint ล่าสุด, ป้องกันการทำงานซ้ำ | None | `107-speckit-implement` |
| [`save-memory`](file:///opt/np-dms-lcbp3/.agents/skills/save-memory/SKILL.md) | `1.9.0` | บันทึก Session Log และอัปเดต Project Memory Override สำหรับบริบทระยะยาว | None | None |

---

### 5️⃣ หมวดหมู่ที่ 5: Shared Foundations & Contracts (สัญญาและบริบทส่วนกลาง)
ไฟล์แกนกลางที่แชร์และผูกมัดกฎระเบียบของระบบเข้าด้วยกัน

| File | Purpose |
| :--- | :--- |
| [`VERSION`](file:///opt/np-dms-lcbp3/.agents/skills/VERSION) | Single Source of Truth สำหรับเวอร์ชันของ Skill Pack (`1.9.0`) |
| [`_LCBP3-CONTEXT.md`](file:///opt/np-dms-lcbp3/.agents/skills/_LCBP3-CONTEXT.md) | Shared LCBP3 Context สรุป Tier 1 Non-Negotiables, Domain Glossary, Key Files |
| [`_LCBP3-CONTRACTS.md`](file:///opt/np-dms-lcbp3/.agents/skills/_LCBP3-CONTRACTS.md) | Worker Task Packet, Reviewer Evidence Bar, TDD Evidence Format, Durable Ledger |
| [`skills.md`](file:///opt/np-dms-lcbp3/.agents/skills/skills.md) | ภาพรวมความสามารถ สถาปัตยกรรมความปลอดภัย และ Dependency Matrix ของทักษะทั้งหมด |

---

## 🛡️ 3. สรุปกฎระเบียบสำคัญ (Tier 1 Non-Negotiables)

ทุกทักษะที่เกี่ยวข้องกับการเขียนโค้ดและตรวจสอบ จะบังคับใช้กฎหลักดังต่อไปนี้:

1. **ADR-019 (Hybrid UUID Strategy):** ใช้ `publicId: string` (UUIDv7) สำหรับ Public API เท่านั้น ห้ามใช้ `parseInt()`, `Number()`, หรือ `+` กับ UUID และห้าม fallback `id ?? ''`
2. **ADR-044 (Direct SQL Schema):** ปรับปรุง Database Schema ผ่าน SQL DDL โดยตรง (`lcbp3-v1.9.0-schema-02-tables.sql` หรือ `deltas/*.sql`) ห้ามใช้ TypeORM Migrations
3. **ADR-016 (4-Level RBAC & File Upload):** ใช้ CASL AbilityFactory, JwtAuthGuard, AuditLogInterceptor, Two-Phase ClamAV scanning
4. **ADR-023/023A (AI Data Boundary):** รันผ่าน On-premise Ollama / OCR sidecar เข้าถึงข้อมูลผ่าน DMS API เท่านั้น ห้ามต่อ Database ตรง
5. **ADR-002 (Collision-Free Numbering):** Double-locking ด้วย Redis Redlock + TypeORM `@VersionColumn`
6. **ADR-008 (Asynchronous Orchestration):** Background jobs ต้องส่งไปรันที่ BullMQ (`ai-realtime`, `ai-batch`, notifications)
7. **Strict TypeScript:** Zero `any`, Zero `console.log` (ใช้ NestJS `Logger`), Business comments เป็นภาษาไทย, Identifiers เป็นภาษาอังกฤษ
