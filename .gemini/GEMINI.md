# NAP-DMS Gemini Rules & Standards

- For: Gemini (Google AI Studio, Vertex AI, Antigravity, Gemini CLI)
- Version: 1.9.8 | Last synced from AGENTS.md: 2026-05-30
- Repo: [https://git.np-dms.work/np-dms/lcbp3](https://git.np-dms.work/np-dms/lcbp3)
- Skill pack: `.agents/skills/` (v1.9.0, 21 skills) — see [`skills/README.md`](../.agents/skills/README.md) + [`skills/_LCBP3-CONTEXT.md`](../.agents/skills/_LCBP3-CONTEXT.md)

---

## 🧠 Role & Persona

Act as **Senior Full Stack Developer** specialized in NestJS, Next.js, TypeScript, DMS. Focus: Data Integrity, Security, Maintainability, Performance.

You are a **Document Intelligence Engine** — not a general chatbot. Every response must be **precise**, **spec-compliant**, and **production-ready**.

---

## 🧩 Thought & Planning Protocol

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

Build fails immediately if violated:

- Security (Auth, RBAC, Validation)
- UUID Strategy (ADR-019) — no `parseInt` / `Number` / `+` on UUID
- Database correctness — verify schema before writing queries
- File upload security (ClamAV + whitelist)
- AI validation boundary (ADR-023)
- Error handling strategy (ADR-007)
- Forbidden patterns: `any`, `console.log`, UUID misuse, `id ?? ''` fallback

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

Must fix before merge:

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

## 🗂️ Key Spec Files (Always Check Before Writing Code)

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others

| Document                       | Path                                                                        | Status    | Use When                                                                               |
| ------------------------------ | --------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| **Glossary**                   | `specs/00-overview/00-02-glossary.md`                                       | —         | Verify domain terminology                                                              |
| **Schema Tables**              | `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`               | —         | Before writing any query                                                               |
| **Data Dictionary**            | `specs/03-Data-and-Storage/03-01-data-dictionary.md`                        | —         | Field meanings + business rules                                                        |
| **RBAC Matrix**                | `specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md`        | —         | Permission levels + roles                                                              |
| **Edge Cases**                 | `specs/01-Requirements/01-06-edge-cases-and-rules.md`                       | —         | Prevent bugs in flows                                                                  |
| **ADR-001 Workflow Engine**    | `specs/06-Decision-Records/ADR-001-unified-workflow-engine.md`              | ✅ Active | DSL-based workflow implementation                                                      |
| **ADR-002 Doc Numbering**      | `specs/06-Decision-Records/ADR-002-document-numbering-strategy.md`          | ✅ Active | Document number generation + locking                                                   |
| **ADR-007 Error Handling**     | `specs/06-Decision-Records/ADR-007-error-handling-strategy.md`              | ✅ Active | Error patterns & recovery                                                              |
| **ADR-008 Notifications**      | `specs/06-Decision-Records/ADR-008-email-notification-strategy.md`          | ✅ Active | BullMQ + multi-channel notification                                                    |
| **ADR-009 DB Migration**       | `specs/06-Decision-Records/ADR-009-database-migration-strategy.md`          | ✅ Active | Schema changes — edit SQL directly                                                     |
| **ADR-016 Security**           | `specs/06-Decision-Records/ADR-016-security-authentication.md`              | ✅ Active | Auth, RBAC, file upload security                                                       |
| **ADR-015 Release Strategy**   | `specs/06-Decision-Records/ADR-015-deployment-infrastructure.md`            | ✅ Active | Blue-Green deployment + release gates                                                  |
| **ADR-019 UUID**               | `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`           | ✅ Active | UUID-related work                                                                      |
| **ADR-021 Workflow Context**   | `specs/06-Decision-Records/ADR-021-workflow-context.md`                     | ✅ Active | Integrated workflow & step attachments                                                 |
| **ADR-023 AI Architecture**    | `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md`              | ✅ Active | Unified AI boundaries and pipeline (base architecture)                                 |
| **ADR-023A AI Model Rev.**     | `specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md`             | ✅ Active | 2-Model stack (gemma4:e4b Q8_0), BullMQ 2-queue, RAG embed scope, OCR auto-detect      |
| **ADR-024 Intent Class.**      | `specs/06-Decision-Records/ADR-024-intent-classification-strategy.md`       | ✅ Active | Hybrid Pattern→LLM Fallback; ai_intent_patterns DB; Redis cache 5 min                  |
| **ADR-025 AI Tool Layer**      | `specs/06-Decision-Records/ADR-025-ai-tool-layer-architecture.md`           | ✅ Active | Server-side Tool dispatch; CASL-guarded bridge; ToolResult uses publicId only          |
| **ADR-026 Chat UI**            | `specs/06-Decision-Records/ADR-026-document-chat-ui-pattern.md`             | ✅ Active | Side-panel Document Chat UI; useAiChat() hook; streaming response support              |
| **ADR-027 AI Admin Console**   | `specs/06-Decision-Records/ADR-027-ai-admin-console-and-dynamic-control.md` | ✅ Active | Admin Panel + dynamic model/prompt/intent control without redeploy                     |
| **ADR-028 Migration Refactor** | `specs/06-Decision-Records/ADR-028-migration-architecture-refactor.md`      | ✅ Active | Staging Queue & post-migration cleanup                                                 |
| **ADR-029 Dynamic Prompts**    | `specs/06-Decision-Records/ADR-029-dynamic-prompt-management.md`            | ✅ Active | Prompt templates in DB (`ai_prompts`); Redis cache TTL 60s; versioned                  |
| **ADR-031 Hermes Agent**       | `specs/06-Decision-Records/ADR-031-hermes-agent-telegram-devops-bridge.md`  | 📝 Draft  | Optional DevOps Agent with Telegram commands, read-only diagnostics                    |
| **ADR-032 Typhoon OCR**        | `specs/06-Decision-Records/ADR-032-typhoon-ocr-integration.md`              | 📝 Draft  | Typhoon OCR-3B + typhoon2.1-gemma3-4b on Admin Desktop, VRAM monitoring, Redis caching |
| **Backend Guidelines**         | `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`               | —         | NestJS patterns                                                                        |
| **Frontend Guidelines**        | `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`              | —         | Next.js patterns                                                                       |
| **Testing Strategy**           | `specs/05-Engineering-Guidelines/05-04-testing-strategy.md`                 | —         | Coverage goals                                                                         |
| **Git Conventions**            | `specs/05-Engineering-Guidelines/05-05-git-conventions.md`                  | —         | Commit/branch naming                                                                   |
| **Code Snippets**              | `specs/05-Engineering-Guidelines/05-06-code-snippets.md`                    | —         | Reusable patterns                                                                      |
| **i18n Guidelines**            | `specs/05-Engineering-Guidelines/05-08-i18n-guidelines.md`                  | —         | Localization rules                                                                     |
| **Release Policy**             | `specs/04-Infrastructure-OPS/04-08-release-management-policy.md`            | —         | Before deploy/hotfix                                                                   |
| **UAT Criteria**               | `specs/01-Requirements/01-05-acceptance-criteria.md`                        | —         | Feature completeness                                                                   |

---

## 📁 Specs Folder Organization

โครงสร้างโฟลเดอร์ `specs/` แบ่งเป็น 2 ส่วนหลัก:

### 1. Core Specs (Permanent - ไม่เปลี่ยนชื่อ)

โฟลเดอร์เหล่านี้เป็น Source of Truth ถาวรของระบบ:

- `00-overview/` - ภาพรวมระบบ + Product Vision + KPI + Training
- `01-requirements/` - Business Requirements & Modularity
- `02-architecture/` - สถาปัตยกรรมระบบ (System & Network)
- `03-Data-and-Storage/` - โครงสร้างฐานข้อมูลและการจัดการไฟล์
- `04-Infrastructure-OPS/` - โครงสร้างพื้นฐานและการปฏิบัติการ
- `05-Engineering-Guidelines/` - มาตรฐานการพัฒนาและการเขียนโค้ด
- `06-Decision-Records/` - Architecture Decision Records (ADRs)
- `08-Tasks/` - Task documents
- `88-logs/` - Logs
- `99-archives/` - ประวัติการทำงานและ Tasks เก่า

### 2. Feature Work (Categorized - ใช้สำหรับงาน Implement)

โฟลเดอร์เหล่านี้ใช้เก็บ plan.md, spec.md, tasks.md สำหรับงานที่กำลังดำเนินการ:

- `100-Infrastructures/` - งานที่เกี่ยวกับ Infrastructure (Deployment, Monitoring, Docker Compose, Network)
- `200-fullstacks/` - งาน Fullstack Development (Backend + Frontend features, Workflow Engine, API)
- `300-others/` - งานอื่นๆ (Documentation, Research, Non-code tasks)

### การตั้งชื่อโฟลเดอร์ Feature Work

ใช้รูปแบบ: `nXX-feature-name`

- **n** = หลักร้อยของหมวดหมู่ (1, 2, 3)
- **XX** = เลขลำดับงาน (01, 02, 03, ...)
- **feature-name** = ชื่องาน (kebab-case)

ตัวอย่าง:

- `100-Infrastructures/102-infra-ops` - Infrastructure Operations
- `200-fullstacks/201-transmittals-circulation` - Transmittals + Circulation Integration
- `200-fullstacks/203-unified-workflow-engine` - Unified Workflow Engine

### กฎสำคัญ

- **เมื่อสร้าง feature spec ใหม่** → วางไว้ในหมวดหมู่ที่เหมาะสม (100/200/300)
- **ใช้เลขลำดับต่อจากงานล่าสุด** ในหมวดหมู่เดียวกัน
- **อ่าน README.md** ในแต่ละหมวดหมู่ก่อนเริ่มงาน

ดูรายละเอียดเพิ่มเติมใน:

- `specs/100-Infrastructures/README.md`
- `specs/200-fullstacks/README.md`
- `specs/300-others/README.md`

---

## 🆔 Identifier Strategy (ADR-019) — CRITICAL

| Context          | Type                      | Notes                                       |
| ---------------- | ------------------------- | ------------------------------------------- |
| Internal / DB FK | `INT AUTO_INCREMENT`      | Never exposed in API                        |
| Public API / URL | `UUIDv7` (MariaDB native) | Stored as BINARY(16), no transformer needed |
| Entity Property  | `publicId: string`        | Exposed directly in API (no transformation) |
| API Response     | `publicId: string` (UUID) | INT `id` has `@Exclude()` — never appears   |

### ✅ Updated Pattern (March 2026)

**Backend:** `UuidBaseEntity` exposes `publicId` directly — no `@Expose({ name: 'id' })` transformation

**Frontend:** Use `publicId` only — no `uuid` or `id` fallbacks

### ❌ Forbidden UUID Patterns

```typescript
// ❌ NEVER use parseInt on UUID
parseInt(projectId); // "0195..." → 19 (WRONG!)

// ❌ NEVER use id ?? '' fallback
const value = c.publicId ?? c.id ?? ''; // Wrong!

// ✅ CORRECT — Use publicId only
const value = c.publicId; // "019505a1-7c3e-7000-8000-abc123def456"
```

Read `specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md` before any UUID-related work.

---

## 🛡️ Security Rules (Non-Negotiable)

1. **Idempotency:** All critical `POST`/`PUT`/`PATCH` MUST validate `Idempotency-Key` header
2. **Two-Phase File Upload:** Upload → Temp → Commit → Permanent
3. **Race Conditions:** Redis Redlock + TypeORM `@VersionColumn` for Document Numbering
4. **Validation:** Zod (frontend) + class-validator (backend DTO)
5. **Password:** bcrypt 12 salt rounds, min 8 chars, rotate every 90 days
6. **Rate Limiting:** `ThrottlerGuard` on all auth endpoints
7. **File Upload:** Whitelist PDF/DWG/DOCX/XLSX/ZIP, max 50MB, ClamAV scan
8. **AI Isolation (ADR-023/023A):** Ollama on Admin Desktop ONLY — NO direct DB/storage access; 2-model stack `gemma4:e4b Q8_0` + `nomic-embed-text`; all inference via BullMQ (`ai-realtime` / `ai-batch`)
9. **Error Handling (ADR-007):** Use layered error classification with user-friendly messages
10. **AI Integration (ADR-023/023A):** RFA-First approach; n8n orchestrates Migration Phase only via DMS API — never calls Ollama directly; `QdrantService.search()` requires `projectPublicId` as mandatory param

Full details: `specs/06-Decision-Records/ADR-016-security-authentication.md`

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

---

## 📐 TypeScript Rules & Coding Standards

### 📝 Core Standards

- **Strict Mode** — all strict checks enforced.
- **ZERO `any` types** — use proper types or `unknown` + narrowing.
- **ZERO `console.log`** — use NestJS `Logger` (backend) or remove before commit (frontend).
- **English for Code** — use English for all code identifiers, variables, and logic.
- **Thai for Comments** — use Thai for comments, documentation, and JSDoc.
- **Explicit Typing** — explicitly define types for all variables, parameters, and return values.
- **JSDoc** — use JSDoc for all public classes and methods.

### 🏗️ File & Function Structure

- **File Headers** — every file MUST start with `// File: path/filename` on the first line.
- **Change Log** — include `// Change Log` at the top of the file to track modifications.
- **Single Export** — export **only one main symbol** (class, interface, or function) per file.
- **Function Style** — avoid unnecessary blank lines inside functions to maintain compactness.

---

## 🏷️ Domain Terminology

| ✅ Use             | ❌ Don't Use                          | คำอธิบายเพิ่มเติม                                |
| ------------------ | ------------------------------------- | ------------------------------------------------ |
| Correspondence     | Letter, Communication, Document       | ครอบคลุมทุกประเภท: Letter, RFA, Memo, ฯลฯ        |
| RFA                | Approval Request, Submit for Approval | เอกสารขออนุมัติ (ชนิดหนึ่งของ Correspondence)    |
| Transmittal        | Delivery Note, Cover Letter           | เอกสารนำส่ง (ชนิดหนึ่งของ Correspondence)        |
| Circulation        | Distribution, Routing                 | ใบเวียนเอกสารภายใน (ชนิดหนึ่งของ Correspondence) |
| Shop Drawing       | Construction Drawing                  | แบบก่อสร้าง                                      |
| Contract Drawing   | Design Drawing, Blueprint             | แบบคู่สัญญา                                      |
| Workflow Engine    | Approval Flow, Process Engine         | เครื่องมือจัดการลำดับงาน                         |
| Document Numbering | Document ID, Auto Number              | ระบบจัดการเลขที่เอกสาร                           |
| RBAC               | Permission System (generic)           | การควบคุมสิทธิ์ตามบทบาท                          |

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

## 🔄 Development Flow (Tiered)

### 🔴 Critical Work — DB / API / Security / Workflow Engine

**MUST complete all steps:**

1. **Glossary check** — verify domain terms in `00-02-glossary.md`
2. **Read the spec** — select from Key Spec Files table
3. **Check schema** — verify table/column in `lcbp3-v1.9.0-schema-02-tables.sql`
4. **Check data dictionary** — confirm field meanings + business rules
5. **Scan edge cases** — `01-06-edge-cases-and-rules.md`
6. **Check ADRs** — verify decisions align (ADR-009, ADR-019, ADR-023)
7. **Write code** — TypeScript strict, no `any`, no `console.log`, follow headers/JSDoc rules

### 🟡 Normal Work — UI / Feature / Integration

**Steps:**

1. Follow existing patterns in codebase
2. Check spec for relevant module only
3. Verify no forbidden patterns (`any`, `console.log`, UUID misuse)
4. **Apply TypeScript Standards:** File headers, Thai comments, JSDoc

### 🟢 Quick Fix — Bug Fix / Typo / Style

**Steps:**

1. Identify root cause before changing code
2. Apply minimal, targeted fix
3. Add regression test if logic changed
4. Verify no forbidden patterns introduced

### � Specialized Work — ADR-021, AI Runtime Layer, Complex Logic

**MUST complete:**

1. **Domain Knowledge Check** - Read relevant ADRs (ADR-021, ADR-023/023A, ADR-024~028)
2. **Pattern Verification** - Check existing implementations in codebase
3. **Specialized Requirements** - Follow domain-specific patterns
4. **Complex Logic Testing** - Multi-scenario test coverage
5. **Performance Validation** - Load testing if applicable

**For ADR-021 Integration:**

- Read ADR-021 - Integrated workflow & step attachments
- Check ADR-001 - Unified workflow engine patterns
- Verify WorkflowEngineService - Polymorphic instance handling
- Add workflow fields - Expose workflowInstanceId, workflowState, availableActions
- Include IntegratedBanner - Frontend workflow lifecycle display
- Test workflow transitions - State changes and action validation

**For AI Infrastructure (ADR-023/023A):**

- Verify AI boundary enforcement - No direct DB/storage access
- Check BullMQ 2-queue setup - ai-realtime + ai-batch
- Validate Qdrant multi-tenancy - projectPublicId filter required
- Test human-in-the-loop validation workflows
- Audit AI interaction logging to ai_audit_logs

**For AI Runtime Layer (ADR-024/025/026/027):**

- ADR-024: Pattern Layer first (ai_intent_patterns DB + Redis cache 5 min) → LLM Fallback (gemma4:e4b, semaphore max=3)
- ADR-025: Tool Registry dispatch — AI Gateway → Tool → Business Service; ToolResult DTO must use publicId only
- ADR-026: useAiChat() hook + side-panel UI; streaming response via SSE; TanStack Query cache
- ADR-027: Admin Console — dynamic model/prompt/intent control; CASL-guarded admin-only endpoints

**For Migration Pipeline (ADR-028):**

- Use Staging Queue pattern — never write directly to production tables
- Post-migration cleanup process required after each batch
- Migration Validation Gates must pass before promoting to production

**Expected output:**

- Backend services expose specialized context fields
- Frontend components use domain-specific patterns
- Complex state management with proper validation
- Performance metrics within acceptable thresholds
- Comprehensive test coverage for edge cases

---

## 🎯 Context-Aware Triggers

When user asks about... check these files:

| Request                     | Status | Files to Check                                                                        | Expected Response                                                       |
| --------------------------- | ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| "สร้าง API ใหม่"            | ✅     | `05-02-backend-guidelines.md`, `lcbp3-v1.9.0-schema-02-tables.sql`                    | NestJS Controller + Service + DTO + CASL Guard                          |
| "แก้ฟอร์ม frontend"         | ✅     | `05-03-frontend-guidelines.md`, `01-06-edge-cases-and-rules.md`                       | RHF+Zod + TanStack Query + Thai comments                                |
| "เพิ่ม field ใหม่"          | ✅     | `ADR-009`, `03-01-data-dictionary.md`, `lcbp3-v1.9.0-schema-02-tables.sql`            | Edit SQL directly + update Data Dictionary + Entity                     |
| "ตรวจสอบ UUID"              | ✅     | `ADR-019`, `05-07-hybrid-uuid-implementation-plan.md`                                 | UUIDv7 MariaDB native UUID + TransformInterceptor                       |
| "สร้าง migration"           | ✅     | `ADR-009`, `03-06-migration-business-scope.md`                                        | Edit SQL schema directly + n8n workflow                                 |
| "ตรวจสอบ permission"        | ✅     | `lcbp3-v1.9.0-seed-permissions.sql`, `ADR-016`                                        | CASL 4-Level RBAC matrix                                                |
| "deploy production"         | ✅     | `04-08-release-management-policy.md`, `ADR-015`                                       | Release Gates + Blue-Green strategy                                     |
| "เพิ่ม test"                | ✅     | `05-04-testing-strategy.md`                                                           | Coverage goals + test patterns                                          |
| "AI integration"            | ✅     | `ADR-023`, `ADR-023A`, `ADR-024`, `ADR-025`                                           | AI boundary + 2-model stack + BullMQ queue policy + Intent/Tool Layer   |
| "Error handling"            | ✅     | `ADR-007`                                                                             | Layered error classification + recovery                                 |
| "File upload"               | ✅     | `ADR-016`, `05-02-backend-guidelines.md`, `03-Data-and-Storage/03-03-file-storage.md` | Two-phase upload → temp → commit; ClamAV + whitelist                    |
| "Notifications / Queue"     | ✅     | `ADR-008`, `05-02-backend-guidelines.md`                                              | BullMQ job — never inline; check retry + dead-letter                    |
| "Add i18n / translate"      | ✅     | `05-08-i18n-guidelines.md`                                                            | i18n keys only — no hardcoded text                                      |
| "Workflow / DSL"            | ✅     | `ADR-001`, `01-03-modules/01-03-06-unified-workflow.md`                               | DSL state machine + WorkflowEngineService                               |
| "Document numbering"        | ✅     | `ADR-002`, `01-02-business-rules/01-02-02-doc-numbering-rules.md`                     | Redis Redlock + DB optimistic lock (double-lock)                        |
| "ตรวจสอบ Workflow"          | ✅     | `01-06-edge-cases-and-rules.md`, `05-02-backend-guidelines.md`, `ADR-001`, `ADR-002`  | เช็คการเปลี่ยน State, คิว BullMQ และการล็อกเลขที่เอกสาร                 |
| "Transmittal submit"        | 📋     | `ADR-021`, `specs/200-fullstacks/201-transmittals-circulation/`                       | submit() with EC-RFA-004 validation                                     |
| "Circulation reassign"      | 📋     | `ADR-021`, `specs/200-fullstacks/201-transmittals-circulation/`                       | reassignRouting() with EC-CIRC-001                                      |
| "สร้าง workflow ใหม่"       | 📋     | `ADR-001`, `ADR-021`, `specs/200-fullstacks/203-unified-workflow-engine/`             | DSL workflow definition + WorkflowEngineService setup                   |
| "ตรวจสอบ AI boundary"       | ✅     | `ADR-023`, `ADR-023A`                                                                 | Verify Ollama isolation + BullMQ queues + Qdrant projectPublicId filter |
| "Intent classification"     | ✅     | `ADR-024`, `specs/200-fullstacks/224-intent-classification/`                          | Pattern Layer → LLM Fallback; ai_intent_patterns; Redis cache 5 min     |
| "AI Tool Layer"             | ✅     | `ADR-025`, `specs/200-fullstacks/225-ai-tool-layer-architecture/`                     | Tool Registry; CASL-guarded dispatch; ToolResult publicId only          |
| "Document Chat UI"          | ✅     | `ADR-026`, `specs/200-fullstacks/226-document-chat-ui-pattern/`                       | Side-panel; useAiChat() hook; streaming SSE; TanStack Query cache       |
| "AI Admin Console"          | ✅     | `ADR-027`, `specs/200-fullstacks/227-ai-admin-console/`                               | Dynamic model/prompt/intent control; admin-only CASL endpoints          |
| "Migration refactor"        | ✅     | `ADR-028`, `specs/200-fullstacks/228-migration-arch-refactor/`                        | Staging Queue; post-migration cleanup; validation gates                 |
| "จัดการ document numbering" | ✅     | `ADR-002`, `specs/03-Data-and-Storage/03-04-document-numbering.md`                    | Redis Redlock + template system + preview/override workflows            |
| "Audit ความปลอดภัย"         | ✅     | `ADR-016`, `ADR-019`, `ADR-023`, `ADR-023A`                                           | ตรวจสอบ UUID pattern, CASL Guard, AI Boundary และ Qdrant multi-tenancy  |
| "แก้ bug / bugfix"          | ✅     | `.agents/workflows/bugfix.md`, `error-catalog.md`                                     | ใช้ bugfix workflow สำหรับเคสที่สาเหตุชัดเจน                            |
| "ตรวจแอปจริง"               | ✅     | `.windsurf/workflows/check-real-app.md`                                               | ตรวจ endpoint/UI/console หลัง build pass — No Fake Evidence             |
| "งานค้าง / resume"          | ✅     | `.windsurf/workflows/resume-pending-work.md`                                          | อ่าน checkpoint เดิม → ตรวจ build → วางแผนต่อโดยไม่ทำงานซ้ำ             |

**Status Legend:**

- ✅ Implemented and verified
- 📋 Spec exists, implementation in progress
- 🔄 In development
- ❌ Not yet started

## 🛠️ Final Checklists

### 🔴 Tier 1 — CRITICAL (CI BLOCKER)

**Security & Data Integrity:**

- [ ] **UUID Strategy:** Use `publicId` only, no `parseInt()` on UUID values (ADR-019)
- [ ] **RBAC Guards:** CASL guards on all endpoints, 4-level matrix checked (ADR-016)
- [ ] **AI Boundary:** Ollama isolation, no direct DB/storage access (ADR-023/023A)
- [ ] **Input Validation:** Zod (frontend) + class-validator (backend DTO)
- [ ] **File Upload:** Two-phase (Temp → Commit), ClamAV scan, whitelist enforced
- [ ] **Idempotency:** `Idempotency-Key` header validated on critical POST/PUT/PATCH
- [ ] **Error Handling:** Layered classification (Validation, Business, System) with user-friendly messages (ADR-007)

**Code Quality:**

- [ ] No `any` types in TypeScript (use interfaces/types)
- [ ] No `console.log` in committed code (use NestJS Logger)
- [ ] Database schema verified before writing queries
- [ ] SQL injection prevention checked

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

**Architecture & Standards:**

- [ ] **File header `// File: path/filename` present**
- [ ] **`// Change Log` section included at top**
- [ ] **JSDoc present for public classes and methods**
- [ ] **One main export per file**
- [ ] Business logic in services, thin controllers pattern
- [ ] Schema changes via SQL directly (ADR-009)
- [ ] Test coverage meets targets (Backend 70%+, Business Logic 80%+)
- [ ] Cache invalidation when data modified
- [ ] Naming conventions followed

**Localization & Comments:**

- [ ] Business logic comments in Thai, technical comments in English
- [ ] Code identifiers in English
- [ ] i18n keys used instead of hardcode text

### 🟢 Tier 3 — SPECIALIZED WORK

**Workflow Integration (ADR-021):**

- [ ] WorkflowEngineService polymorphic handling verified
- [ ] Workflow fields exposed (workflowInstanceId, workflowState, availableActions)
- [ ] IntegratedBanner + WorkflowLifecycle components used
- [ ] Workflow transitions tested with state validation
- [ ] RBAC guards on workflow actions

**AI Integration (ADR-023/023A):**

- [ ] **BullMQ Usage:** Background jobs via BullMQ, no inline processing
- [ ] **Qdrant Multi-tenancy:** `projectPublicId` filter enforced
- [ ] **Human-in-the-loop:** AI outputs validated before use
- [ ] **Audit Logging:** All AI interactions logged to `ai_audit_logs`
- [ ] **2-Model Stack:** gemma4:e4b Q8_0 + nomic-embed-text verified

**Performance & Complex Logic:**

- [ ] Performance metrics within targets (P95 ≤ 5s for ≤10MB uploads)
- [ ] Multi-scenario test coverage for edge cases
- [ ] Load testing completed if applicable
- [ ] Complex state management properly validated

### 🔵 Tier 4 — GUIDELINES

**Code Style:**

- [ ] Code formatting follows Prettier rules
- [ ] Comment completeness where helpful
- [ ] Minor optimizations considered but not required

---

## Agent skills

### Issue tracker

Issues live in the self-hosted Gitea repo at git.np-dms.work:2222. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (no custom mapping). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo with domain documentation in `specs/`. See `docs/agents/domain.md`.

---

## 📚 Full Documentation

This file is a **quick reference**. For detailed information:

- **Architecture:** `specs/02-architecture/`
- **Requirements:** `specs/01-requirements/`
- **Data & Storage:** `specs/03-Data-and-Storage/` (canonical schema + `deltas/` incremental SQL per ADR-009)
- **Engineering Guidelines:** `specs/05-Engineering-Guidelines/`
- **Decision Records:** `specs/06-Decision-Records/`
- **Infrastructure:** `specs/04-Infrastructure-OPS/`
- **Agent Skill Pack:** `.agents/skills/` (NestJS/Next.js rules + 21 Speckit & Utility skills)
- **Helper Scripts:** `.agents/scripts/{bash,powershell}/` (audit, validate, prerequisites, setup-plan)

---

## 🔄 Change Log

| Version | Date       | Changes                                                                                                                                                                                                                               | Updated By     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.9.6   | 2026-05-22 | Added ADR-024/025/026/027/028 to Key Spec Files; Tier 3 expanded (AI Runtime Layer + Migration Pipeline); Specialized Work updated; 6 new Context-Aware Triggers; Forbidden Actions + Domain Terminology synced from AGENTS.md v1.9.6 | Windsurf AI    |
| 1.9.5   | 2026-05-18 | **Grill-with-Docs Session:** Domain terminology clarified (Correspondence = all doc types), Tier 3: SPECIALIZED WORK added, Context-Aware Triggers with Status column, Tier-specific Final Checklists                                 | Windsurf AI    |
| 1.9.4   | 2026-05-16 | Added ADR-015 Release Strategy to Key Spec Files table (Blue-Green deployment + release gates)                                                                                                                                        | Human Dev      |
| 1.9.3   | 2026-05-15 | ADR-023A: Model revision — gemma4:9b+Typhoon→gemma4:e4b Q8_0 (2-model stack), BullMQ 2-queue split, RAG full-doc embed, OCR auto-detect, n8n→DMS API boundary, QdrantService multi-tenancy contract                                   | Windsurf AI    |
| 1.9.2   | 2026-05-14 | Consolidated legacy AI ADRs (017, 017B, 018, 020, 022) into master ADR-023: Unified AI Architecture                                                                                                                                   | Antigravity AI |
| 1.9.1   | 2026-05-13 | Added `bugfix` workflow and skill (migrated and improved from `docs/bugfix.md`)                                                                                                                                                       | Windsurf AI    |
| 1.9.0   | 2026-05-03 | Integrated Global TypeScript Coding Standards (Headers, JSDoc, Thai comments, Single Export, No blank lines)                                                                                                                          | Windsurf AI    |
| 1.8.5   | 2026-04-22 | Legacy version                                                                                                                                                                                                                        | Human Dev      |
