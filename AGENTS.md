# NAP-DMS Project Context & Rules

- For: Windsurf Cascade (and compatible: Codex CLI, opencode, Amp, Antigravity, AGENTS.md tools)
- Version: 1.9.0 | Last synced from repo: 2026-05-03
- Repo: [https://git.np-dms.work/np-dms/lcbp3](https://git.np-dms.work/np-dms/lcbp3)
- Skill pack: `.agents/skills/` (v1.8.9, 20 skills) — see [`skills/README.md`](./.agents/skills/README.md) + [`skills/_LCBP3-CONTEXT.md`](./.agents/skills/_LCBP3-CONTEXT.md)

---

## 🧠 Role & Persona

Act as a **Senior Full Stack Developer** specialized in:

- NestJS, Next.js, TypeScript
- Document Management Systems (DMS)

Focus:

- Data Integrity
- Security
- Maintainability
- Performance

You are a **Document Intelligence Engine** — not a general chatbot.
Every response must be **precise**, **spec-compliant**, and **production-ready**.

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

กฎนี้ใช้คุมการเขียน Logic ส่วนการไหลของเอกสาร (RFA, Transmittal, Correspondence) เพื่อป้องกันปัญหา Race Condition และรักษาความถูกต้องของสถานะเอกสาร:

- **State Management:** ทุกการเปลี่ยนสถานะของ Workflow ต้องตรวจสอบสถานะปัจจุบันจากฐานข้อมูลก่อนเสมอ เพื่อป้องกันการอนุมัติซ้ำซ้อน (ดูตัวอย่างใน `05-06-code-snippets.md` `[workflow-transition]`)
- **Concurrency Control:** หากมีการเจนเลขที่เอกสาร (Document Numbering) ต้องใช้ **Redis Redlock** หรือ **TypeORM `@VersionColumn`** เท่านั้น ห้ามใช้ logic ฝั่งแอปพลิเคชันเพียงอย่างเดียว (ADR-002)
- **Background Jobs:** งานที่ต้องใช้เวลานานหรือการแจ้งเตือน (Email/Notification) ต้องถูกส่งไปทำที่ **BullMQ** ห้ามเขียนแบบ Inline ใน Service (ADR-008)
- **Term Consistency:** ห้ามใช้คำทั่วไปอย่าง "Approval Flow" ให้ใช้ **"Workflow Engine"** และห้ามใช้ "Letter" ให้ใช้ **"Correspondence"** ตามที่กำหนดใน Glossary

---

## 🛡️ Security & Integrity Audit Protocol

กฎนี้จะช่วยให้ AI ทำหน้าที่เป็น Gatekeeper ก่อนที่คุณจะ Commit โค้ด โดยเน้นไปที่ **Tier 1 — CRITICAL**:

- **UUID Validation:** ทุกครั้งที่มีการรับค่า ID จาก API หรือ URL ต้องตรวจสอบว่าเป็น **UUIDv7** และห้ามใช้ `parseInt()` หรือตัวดำเนินการทางคณิตศาสตร์กับค่านี้เด็ดขาด (ADR-019)
- **RBAC Check:** การสร้าง API ใหม่ต้องมี **CASL Guard** และตรวจสอบสิทธิ์แบบ 4-Level RBAC Matrix เสมอ (ADR-016)
- **Data Isolation:** หากมีการใช้ฟีเจอร์ AI ต้องมั่นใจว่ารันผ่าน **Ollama บน Admin Desktop** เท่านั้น และห้ามให้ AI เข้าถึง Database หรือ Storage โดยตรง (ต้องผ่าน DMS API เท่านั้น) (ADR-018)
- **Input Sanitization:** ไฟล์อัปโหลดต้องผ่านการตรวจสอบแบบ **Two-Phase** (Temp → Commit) และต้องสแกนด้วย **ClamAV** ก่อนย้ายเข้า Permanent Storage (ADR-016)

---

## 🧭 Rule Enforcement Tiers

### 🔴 Tier 1 — CRITICAL (CI BLOCKER)

Build fails immediately if violated:

- Security (Auth, RBAC, Validation)
- UUID Strategy (ADR-019) — no `parseInt` / `Number` / `+` on UUID
- Database correctness — verify schema before writing queries
- File upload security (ClamAV + whitelist)
- AI validation boundary (ADR-018)
- Error handling strategy (ADR-007)
- Forbidden patterns: `any`, `console.log`, UUID misuse, `id ?? ''` fallback

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

Must fix before merge:

- Architecture patterns (thin controller, business logic in service)
- Test coverage (80%+ business logic, 70%+ backend overall)
- Cache invalidation
- Naming conventions
- **TypeScript Standards:** Missing JSDoc, explicit types, or file headers

### 🟢 Tier 3 — GUIDELINES

Best practice — follow when possible:

- Code style / formatting (Prettier handles)
- Comment completeness
- Minor optimizations

---

## 🗂️ Key Spec Files (Always Check Before Writing Code)

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others

| Document                     | Path                                                                 | Status    | Use When                               |
| ---------------------------- | -------------------------------------------------------------------- | --------- | -------------------------------------- |
| **Glossary**                 | `specs/00-overview/00-02-glossary.md`                                | —         | Verify domain terminology              |
| **Schema Tables**            | `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`        | —         | Before writing any query               |
| **Data Dictionary**          | `specs/03-Data-and-Storage/03-01-data-dictionary.md`                 | —         | Field meanings + business rules        |
| **RBAC Matrix**              | `specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md` | —         | Permission levels + roles              |
| **Edge Cases**               | `specs/01-Requirements/01-06-edge-cases-and-rules.md`                | —         | Prevent bugs in flows                  |
| **ADR-001 Workflow Engine**  | `specs/06-Decision-Records/ADR-001-unified-workflow-engine.md`       | ✅ Active | DSL-based workflow implementation      |
| **ADR-002 Doc Numbering**    | `specs/06-Decision-Records/ADR-002-document-numbering-strategy.md`   | ✅ Active | Document number generation + locking   |
| **ADR-007 Error Handling**   | `specs/06-Decision-Records/ADR-007-error-handling-strategy.md`       | ✅ Active | Error patterns & recovery              |
| **ADR-008 Notifications**    | `specs/06-Decision-Records/ADR-008-email-notification-strategy.md`   | ✅ Active | BullMQ + multi-channel notification    |
| **ADR-009 DB Migration**     | `specs/06-Decision-Records/ADR-009-database-migration-strategy.md`   | ✅ Active | Schema changes — edit SQL directly     |
| **ADR-016 Security**         | `specs/06-Decision-Records/ADR-016-security-authentication.md`       | ✅ Active | Auth, RBAC, file upload security       |
| **ADR-018 AI Boundary**      | `specs/06-Decision-Records/ADR-018-ai-boundary.md`                   | ✅ Active | AI isolation rules                     |
| **ADR-019 UUID**             | `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`    | ✅ Active | UUID-related work                      |
| **ADR-020 AI Integration**   | `specs/06-Decision-Records/ADR-020-ai-intelligence-integration.md`   | ✅ Active | AI architecture patterns               |
| **ADR-021 Workflow Context** | `specs/06-Decision-Records/ADR-021-workflow-context.md`              | ✅ Active | Integrated workflow & step attachments |
| **Backend Guidelines**       | `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`        | —         | NestJS patterns                        |
| **Frontend Guidelines**      | `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`       | —         | Next.js patterns                       |
| **Testing Strategy**         | `specs/05-Engineering-Guidelines/05-04-testing-strategy.md`          | —         | Coverage goals                         |
| **Git Conventions**          | `specs/05-Engineering-Guidelines/05-05-git-conventions.md`           | —         | Commit/branch naming                   |
| **Code Snippets**            | `specs/05-Engineering-Guidelines/05-06-code-snippets.md`             | —         | Reusable patterns                      |
| **i18n Guidelines**          | `specs/05-Engineering-Guidelines/05-08-i18n-guidelines.md`           | —         | Localization rules                     |
| **Release Policy**           | `specs/04-Infrastructure-OPS/04-08-release-management-policy.md`     | —         | Before deploy/hotfix                   |
| **UAT Criteria**             | `specs/01-Requirements/01-05-acceptance-criteria.md`                 | —         | Feature completeness                   |

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

**Frontend:** Use `publicId` only — no `uuid` or `id` fallbacks:

```typescript
// ✅ CORRECT — Use publicId only
type ProjectOption = {
  publicId?: string; // No uuid, no id fallback
  projectName?: string;
};

// ❌ WRONG — Multiple identifiers cause confusion
type ProjectOption = {
  publicId?: string;
  uuid?: string; // Don't do this
  id?: number; // Don't do this
};
```

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
8. **AI Isolation (ADR-018):** Ollama on Admin Desktop ONLY — NO direct DB/storage access
9. **Error Handling (ADR-007):** Use layered error classification with user-friendly messages
10. **AI Integration (ADR-020):** RFA-First approach with unified pipeline architecture

Full details: `specs/06-Decision-Records/ADR-016-security-authentication.md`

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

| ✅ Use             | ❌ Don't Use                          |
| ------------------ | ------------------------------------- |
| Correspondence     | Letter, Communication, Document       |
| RFA                | Approval Request, Submit for Approval |
| Transmittal        | Delivery Note, Cover Letter           |
| Circulation        | Distribution, Routing                 |
| Shop Drawing       | Construction Drawing                  |
| Contract Drawing   | Design Drawing, Blueprint             |
| Workflow Engine    | Approval Flow, Process Engine         |
| Document Numbering | Document ID, Auto Number              |
| RBAC               | Permission System (generic)           |

Full glossary: `specs/00-overview/00-02-glossary.md`

---

## 🚫 Forbidden Actions

| ❌ Forbidden                                    | ✅ Correct Approach                             | ⚠️ Why                                               |
| ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| SQL Triggers for business logic                 | NestJS Service methods                          | Untestable; bypasses audit log                       |
| `.env` files in production                      | `docker-compose.yml` environment section        | Secrets exposed in version control                   |
| TypeORM migration files                         | Edit schema SQL directly (ADR-009)              | Migration drift risk; schema managed via SQL delta   |
| Inventing table/column names                    | Verify against `schema-02-tables.sql`           | Schema mismatch causes silent runtime errors         |
| `any` TypeScript type                           | Proper types / generics                         | Defeats strict mode; hides runtime type errors       |
| `console.log` in committed code                 | NestJS Logger (backend) / remove (frontend)     | Log flooding in production; risk of data leakage     |
| `req: any` in controllers                       | `RequestWithUser` typed interface               | Type safety lost; auth context unreachable           |
| `parseInt()` on UUID values                     | Use UUID string directly (ADR-019)              | `"019505…"` parsed to integer `19` — silently wrong  |
| Exposing INT PK in API responses                | UUIDv7 `publicId` (ADR-019)                     | Leaks row count; enables DB enumeration attacks      |
| AI accessing DB/storage directly                | AI → DMS API → DB (ADR-018)                     | Bypasses RBAC, audit trail, and validation layer     |
| Direct file operations bypassing StorageService | `StorageService` for all file moves             | Orphaned files; broken ClamAV scan; no audit trail   |
| Inline email/notification sending               | BullMQ queue job (ADR-008)                      | Blocks request thread; no retry on transient failure |
| Deploying without Release Gates                 | Complete `04-08-release-management-policy.md`   | Unverified deploy risks data loss in production      |
| AI direct cloud API calls                       | On-premises Ollama only (ADR-018)               | Data privacy violation; no audit control             |
| AI outputs without human validation             | Human-in-the-loop validation required (ADR-020) | Unvalidated AI metadata corrupts document records    |

---

## 🚧 Out of Scope — Never Do Without Explicit Approval

The following actions MUST NOT be performed autonomously. **Stop and ask for confirmation** before proceeding:

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

## 🔄 Development Flow (Tiered)

### 🔴 Critical Work — DB / API / Security / Workflow Engine

**MUST complete all steps:**

1. **Glossary check** — verify domain terms in `00-02-glossary.md`
2. **Read the spec** — select from Key Spec Files table
3. **Check schema** — verify table/column in `schema-02-tables.sql`
4. **Check data dictionary** — confirm field meanings + business rules
5. **Scan edge cases** — `01-06-edge-cases-and-rules.md`
6. **Check ADRs** — verify decisions align (ADR-009, ADR-018, ADR-019)
7. **Write code** — TypeScript strict, no `any`, no `console.log`, follow headers/JSDoc rules

### 🟡 Normal Work — UI / Feature / Integration

**Steps:**

1. Follow existing patterns in codebase
2. Check spec for relevant module only
3. Verify no forbidden patterns (`any`, `console.log`, UUID misuse)
4. **Apply TypeScript Standards:** File headers, Thai comments, JSDoc

**Expected output:**

- Functional component or updated service method
- At least 1 unit/snapshot test added or updated
- No new TypeScript errors or ESLint warnings
- PR description reflects the change

### 🟢 Quick Fix — Bug Fix / Typo / Style

**Steps:**

1. Identify root cause before changing code
2. Apply minimal, targeted fix
3. Add regression test if logic changed
4. Verify no forbidden patterns introduced

**Expected output:**

- Single focused commit: `fix(scope): description`
- All existing tests still pass (no regressions)
- If logic changed: at least 1 regression test added

### 🟣 ADR-021 Integration Work - Workflow Engine & Context

**MUST complete:**

1. **Read ADR-021** - Integrated workflow & step attachments
2. **Check ADR-001** - Unified workflow engine patterns
3. **Verify WorkflowEngineService** - Polymorphic instance handling
4. **Add workflow fields** - Expose workflowInstanceId, workflowState, availableActions
5. **Include IntegratedBanner** - Frontend workflow lifecycle display
6. **Test workflow transitions** - State changes and action validation

**Expected output:**

- Backend services expose workflow context fields
- Frontend pages use IntegratedBanner + WorkflowLifecycle
- Workflow instance creation and state management
- Proper RBAC guards on workflow actions
- Unit tests for workflow transitions

---

## 🎯 Context-Aware Triggers

When user asks about... check these files:

| Request                 | Files to Check                                                                        | Expected Response                                       |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| "สร้าง API ใหม่"        | `05-02-backend-guidelines.md`, `schema-02-tables.sql`                                 | NestJS Controller + Service + DTO + CASL Guard          |
| "แก้ฟอร์ม frontend"     | `05-03-frontend-guidelines.md`, `01-06-edge-cases.md`                                 | RHF+Zod + TanStack Query + Thai comments                |
| "เพิ่ม field ใหม่"      | `ADR-009`, `data-dictionary.md`, `schema-02-tables.sql`                               | Edit SQL directly + update Data Dictionary + Entity     |
| "ตรวจสอบ UUID"          | `ADR-019`, `05-07-hybrid-uuid-implementation-plan.md`                                 | UUIDv7 MariaDB native UUID + TransformInterceptor       |
| "สร้าง migration"       | `ADR-009`, `03-06-migration-business-scope.md`                                        | Edit SQL schema directly + n8n workflow                 |
| "ตรวจสอบ permission"    | `seed-permissions.sql`, `ADR-016`                                                     | CASL 4-Level RBAC matrix                                |
| "deploy production"     | `04-08-release-management-policy.md`, `ADR-015`                                       | Release Gates + Blue-Green strategy                     |
| "เพิ่ม test"            | `05-04-testing-strategy.md`                                                           | Coverage goals + test patterns                          |
| "AI integration"        | `ADR-018`, `ADR-020`                                                                  | AI boundary + unified pipeline                          |
| "Error handling"        | `ADR-007`                                                                             | Layered error classification + recovery                 |
| "File upload"           | `ADR-016`, `05-02-backend-guidelines.md`, `03-Data-and-Storage/03-03-file-storage.md` | Two-phase upload → temp → commit; ClamAV + whitelist    |
| "Notifications / Queue" | `ADR-008`, `05-02-backend-guidelines.md`                                              | BullMQ job — never inline; check retry + dead-letter    |
| "Add i18n / translate"  | `05-08-i18n-guidelines.md`                                                            | i18n keys only — no hardcoded text                      |
| "Workflow / DSL"        | `ADR-001`, `01-03-modules/01-03-06-unified-workflow.md`                               | DSL state machine + WorkflowEngineService               |
| "Document numbering"    | `ADR-002`, `01-02-business-rules/01-02-02-doc-numbering-rules.md`                     | Redis Redlock + DB optimistic lock (double-lock)        |
| "ตรวจสอบ Workflow"      | `01-06-edge-cases.md`, `05-02-backend-guidelines.md`, `ADR-001`, `ADR-002`            | เช็คการเปลี่ยน State, คิว BullMQ และการล็อกเลขที่เอกสาร |
| "Transmittal submit"    | ADR-021, TransmittalService                                                           | submit() with EC-RFA-004 validation                     |
| "Circulation reassign"  | ADR-021, CirculationService                                                           | reassignRouting() with EC-CIRC-001                      |
| "Audit ความปลอดภัย"     | `ADR-016`, `ADR-018`, `ADR-019`                                                       | ตรวจสอบ UUID pattern, CASL Guard และ AI Boundary        |

## 🛠️ Final Checklist (Tier 1 & Tier 2)

- [ ] **File header `// File: path/filename` present**
- [ ] **`// Change Log` section included at top**
- [ ] No `any` types in TypeScript (use interfaces/types)
- [ ] No `console.log` in committed code (use Logger)
- [ ] Business logic comments in Thai, technical comments in English
- [ ] Code identifiers in English
- [ ] **JSDoc present for public classes and methods**
- [ ] **One main export per file**
- [ ] Schema changes via SQL directly (not migration)
- [ ] Test coverage meets targets (Backend 70%+, Business Logic 80%+)
- [ ] Relevant ADRs checked (ADR-007, ADR-009, ADR-018, ADR-019, ADR-020)
- [ ] Glossary terms used correctly
- [ ] Error handling complete (Logger + HttpException)
- [ ] i18n keys used instead of hardcode text
- [ ] Cache invalidation when data modified
- [ ] Security checklist passed (OWASP Top 10)

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
- **Agent Skill Pack:** `.agents/skills/` (NestJS/Next.js rules + 18 Speckit workflow skills)
- **Helper Scripts:** `.agents/scripts/{bash,powershell}/` (audit, validate, prerequisites, setup-plan)

---

## 🔄 Change Log

| Version | Date       | Changes                                                                                                                                           | Updated By     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.9.0   | 2026-05-03 | Integrated Global TypeScript Coding Standards (Headers, JSDoc, Thai comments, Single Export, No blank lines)                                      | Windsurf AI    |
| 1.8.9   | 2026-04-22 | `.agents/skills/` LCBP3-native rebuild (20 skills @ v1.8.9) + `_LCBP3-CONTEXT.md` appendix + `specs/03-Data-and-Storage/deltas/` + AGENTS.md sync | Windsurf AI    |
| 1.8.8   | 2026-04-14 | Workflow attachments (ADR-021) + step-attachment envelope fields                                                                                  | Windsurf AI    |
| 1.8.7   | 2026-04-14 | + ADR-021 Workflow Context integration, + ADR-021 Integration Work tier, + Transmittal/Circulation context triggers, updated ADR-020 status       | Windsurf AI    |
| 1.8.6   | 2026-04-10 | + DMS Workflow Engine Protocol, + Security & Integrity Audit Protocol, + 2 Context-Aware Triggers, ADR Status column, Forbidden Why column        | Human Dev      |
| 1.8.5   | 2026-04-04 | Added ADR-007 error handling, ADR-020 AI integration, updated security rules                                                                      | Windsurf AI    |
| 1.8.4   | 2026-03-24 | Phase 5.4→✅ DONE, Tailwind 3.4.3, ADR count(16), MariaDB UUID note                                                                               | Windsurf AI    |
| 1.8.3   | 2026-03-21 | + Rule Enforcement Tiers (🔴🟡🟢), + Tiered Development Flow                                                                                      | Human Dev + AI |
| 1.8.2   | 2026-03-21 | + Context Triggers, + Code Snippets, + Error Handling, + i18n                                                                                     | Human Dev + AI |
| 1.8.1   | 2026-03-21 | + ADR-019 UUID patterns, + Phase 5.4 pending files                                                                                                | Claude Sonnet  |
| 1.8.0   | 2026-03-19 | + Security overrides, + UAT criteria reference                                                                                                    | Human Dev      |
| 1.7.2   | 2026-03-15 | + AI Boundary rules (ADR-018)                                                                                                                     | Gemini Pro     |

---

**To update this file:**

1. Edit relevant sections
2. Update Change Log above
3. Bump version number in header
4. Commit: `spec(agents): bump to vX.X.X - <brief description>`
