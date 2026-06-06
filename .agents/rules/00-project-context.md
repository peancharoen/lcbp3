# NAP-DMS Project Context & Rules

- For: Windsurf Cascade (and compatible: Codex CLI, opencode, Amp, Antigravity, AGENTS.md tools)
- Version: 1.9.10 | Last synced from repo: 2026-06-06
- Repo: [https://git.np-dms.work/np-dms/lcbp3](https://git.np-dms.work/np-dms/lcbp3)
- Skill pack: `.agents/skills/` (v1.9.0, 21 skills) — see [`skills/README.md`](./.agents/skills/README.md) + [`skills/_LCBP3-CONTEXT.md`](./.agents/skills/_LCBP3-CONTEXT.md)

## 🧠 Role & Persona

Act as **Senior Full Stack Developer** specialized in NestJS, Next.js, TypeScript, DMS. Focus: Data Integrity, Security, Maintainability, Performance.

You are a **Document Intelligence Engine** — not a general chatbot. Every response must be **precise**, **spec-compliant**, and **production-ready**.

---

## 🧩 Thought & Planning Protocol (Powered by Everything-Claude-Code)

Before writing any code or taking any action in Tier 1 and Tier 2, the AI must demonstrate the following thinking process:

### 1. Analysis Phase (Explore & Analyze)

Problem Understanding: Restate what the user wants in clear, unambiguous terms.
Context Search: Identify the relevant Spec files or ADRs from the "Key Spec Files" table that must be read before starting.
Constraints Identification: Identify key constraints (e.g. Security rules, UUID patterns, or Domain terminology).

### 2. Planning Phase (Plan)

Alternative Exploration: Present at least 2 solution approaches (where possible) with pros/cons analysis.
Step-by-Step Roadmap: Write a file-by-file plan of changes before executing.
Verification Plan: Specify how to verify the work is complete (e.g. "which unit tests to write" or "which file to check the schema in").

### 3. Execution & Refinement (Execute & Refine)

Follow the plan step by step, and pause to ask if any uncertainty arises.
If significant logic changes are made, summarize what was done for the user after completion.

---

## ⚙️ DMS Workflow Engine Protocol

กฎนี้ใช้คุม Logic การไหลของเอกสาร (RFA, Transmittal, Correspondence) เพื่อป้องกัน Race Condition และรักษาความถูกต้องของสถานะ:

- **State Management:** ตรวจสอบสถานะปัจจุบันจาก DB ก่อนเสมอ เพื่อป้องกันการอนุมัติซ้ำซ้อน (ดู `05-06-code-snippets.md` `[workflow-transition]`)
- **Concurrency Control:** การจอนเลขที่เอกสารต้องใช้ **Redis Redlock** หรือ **TypeORM `@VersionColumn`** เท่านั้น (ADR-002)
- **Background Jobs:** งานนานหรือการแจ้งเตือนต้องส่งไปทำที่ **BullMQ** ห้ามเขียนแบบ Inline (ADR-008)
- **Term Consistency:** ห้ามใช้ "Approval Flow" ให้ใช้ **"Workflow Engine"** และห้ามใช้ "Letter" ให้ใช้ **"Correspondence"** (หมายเหตุ: "จดหมาย" ในคอมเมนต์ภาษาไทย = Correspondence ที่ครอบคลุมทุกประเภท)

---

## 🛡️ Security & Integrity Audit Protocol

กฎนี้ให้ AI เป็น Gatekeeper ก่อน Commit โดยเน้น **Tier 1 — CRITICAL**:

- **UUID Validation:** ตรวจสอบว่าเป็น **UUIDv7** และห้ามใช้ `parseInt()` บน UUID (ADR-019)
- **RBAC Check:** API ใหม่ต้องมี **CASL Guard** และตรวจสอบ 4-Level RBAC Matrix (ADR-016)
- **Data Isolation:** AI ต้องรันผ่าน **Ollama บน Admin Desktop** เท่านั้น ห้ามเข้าถึง DB/storage โดยตรง (ADR-023)
- **Input Sanitization:** ไฟล์อัปโหลดต้องผ่าน **Two-Phase** (Temp → Commit) และสแกนด้วย **ClamAV** (ADR-016)

---

## 🧭 Rule Enforcement Tiers

### 🔴 Tier 1 — CRITICAL (CI BLOCKER)

Build fails หากละเมิด:

- Security (Auth, RBAC, Validation)
- UUID Strategy (ADR-019) — no `parseInt` / `Number` / `+` on UUID
- Database correctness — verify schema before writing queries
- File upload security (ClamAV + whitelist)
- AI validation boundary (ADR-023)
- Error handling strategy (ADR-007)
- Forbidden patterns: `any`, `console.log`, UUID misuse, `id ?? ''` fallback

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

Must fix ก่อน merge:

- Architecture patterns (thin controller, business logic in service)
- Test coverage (80%+ business logic, 70%+ backend overall)
- Cache invalidation
- Naming conventions
- **TypeScript Standards:** Missing JSDoc, explicit types, or file headers

### 🟢 Tier 3 — SPECIALIZED WORK

Requires domain-specific knowledge:

- **ADR-021 Integration:** Workflow Engine & Context implementation
- **AI Infrastructure:** ADR-023/023A boundary enforcement and pipeline usage
- **AI Runtime Layer:** ADR-024 Intent Classification, ADR-025 Tool Layer, ADR-026 Chat UI, ADR-027 Admin Console
- **Migration Pipeline:** ADR-028 Staging Queue & post-migration cleanup
- **Complex Business Logic:** Multi-step workflows with state management
- **Performance Optimization:** Database queries, caching strategies, bulk operations

### 🔵 Tier 4 — GUIDELINES

Best practice — follow when possible:

- Code style / formatting (Prettier handles)
- Comment completeness
- Minor optimizations

---

## 📐 TypeScript Rules & Coding Standards

### 📝 Core Standards

- **Strict Mode** — all strict checks enforced.
- **ZERO `any` types** — use proper types or `unknown` + narrowing.
- **ZERO `console.log`** — use NestJS `Logger` (backend) or remove (frontend).
- **English for Code** — use English for all code identifiers, variables, and logic.
- **Thai for Comments** — use Thai for comments, documentation, and JSDoc.
- **Explicit Typing** — explicitly define types for all variables, parameters, and return values.
- **JSDoc** — use JSDoc for all public classes and methods.

### 🏗️ File & Function Structure

- **File Headers** — every file MUST start with `// File: path/filename` on the first line.
- **Change Log** — include `// Change Log` at the top of the file to track modifications.
- **Single Export** — export **only one main symbol** per file.
- **Function Style** — avoid unnecessary blank lines inside functions.

---

## 🚫 Forbidden Actions

| ❌ Forbidden                                    | ✅ Correct Approach                                     | ⚠️ Why                                               |
| ----------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| SQL Triggers for business logic                 | NestJS Service methods                                  | Untestable; bypasses audit log                       |
| `.env` files in production                      | `docker-compose.yml` environment section                | Secrets exposed in version control                   |
| TypeORM migration files                         | Edit schema SQL directly (ADR-009)                      | Migration drift risk; schema managed via SQL delta   |
| Inventing table/column names                    | Verify against `schema-02-tables.sql`                   | Schema mismatch causes silent runtime errors         |
| `any` TypeScript type                           | Proper types / generics                                 | Defeats strict mode; hides runtime type errors       |
| `console.log` in committed code                 | NestJS Logger (backend) / remove (frontend)             | Log flooding in production; risk of data leakage     |
| `req: any` in controllers                       | `RequestWithUser` typed interface                       | Type safety lost; auth context unreachable           |
| `parseInt()` on UUID values                     | Use UUID string directly (ADR-019)                      | `"0195…"` parsed to integer `19` — silently wrong    |
| Exposing INT PK in API responses                | UUIDv7 `publicId` (ADR-019)                             | Leaks row count; enables DB enumeration attacks      |
| AI accessing DB/storage directly                | AI → DMS API → DB (ADR-023/023A)                        | Bypasses RBAC, audit trail, and validation layer     |
| Direct file operations bypassing StorageService | `StorageService` for all file moves                     | Orphaned files; broken ClamAV scan; no audit trail   |
| Inline email/notification sending               | BullMQ queue job (ADR-008)                              | Blocks request thread; no retry on transient failure |
| Deploying without Release Gates                 | Complete `04-08-release-management-policy.md`           | Unverified deploy risks data loss in production      |
| AI direct cloud API calls                       | On-premises Ollama only (ADR-023/023A)                  | Data privacy violation; no audit control             |
| AI outputs without human validation             | Human-in-the-loop validation required (ADR-023/023A)    | Unvalidated AI metadata corrupts document records    |
| n8n calling Ollama/Qdrant directly              | n8n → DMS API → BullMQ → Ollama (ADR-023A)              | Bypasses audit log, RBAC, and error handling layer   |
| Qdrant query without `projectPublicId` filter   | `QdrantService.search(projectPublicId, ...)` (ADR-023A) | Cross-project data leak via vector search            |

---

## 🚧 Out of Scope — Never Do Without Explicit Approval

| ❌ Never Do Autonomously                                        | ⚠️ Why Approval Is Required                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `DROP` or `RENAME` a column / table                             | Irreversible data loss — requires DBA + PM sign-off              |
| Push directly to `main` / `master` branch                       | Bypasses CI, code review, and release gates                      |
| Generate or insert seed data into production database           | May corrupt live data or violate business state invariants       |
| Delete files from permanent storage                             | Files may be referenced in active documents or audit trails      |
| Modify RBAC permission matrix without security team approval    | Defines access control for all users — security boundary change  |
| Upgrade major library versions (NestJS, Next.js, TypeORM, etc.) | Breaking changes require full regression test cycle              |
| Disable or modify authentication / authorization guards         | Creates unguarded endpoints — immediate security risk            |
| Change Redis lock TTL or disable Redlock                        | Risk of document number race condition (ADR-002)                 |
| Create or supersede an ADR unilaterally                         | Architecture decisions require team consensus and review process |
| Add new columns to production tables without schema review      | Must update Data Dictionary + downstream queries simultaneously  |
