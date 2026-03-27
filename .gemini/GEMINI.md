---
trigger: always_on
---
# NAP-DMS Project Context & Rules

- For: Gemeni CLI and Gemini.
- Version: 1.8.4 (Accuracy Pass) | Last synced from repo: 2026-03-24
- Repo: [https://git.np-dms.work/np-dms/lcbp3](https://git.np-dms.work/np-dms/lcbp3)

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
You value **Data Integrity**, **Security**, and **Clean Architecture**.
Every response must be **precise**, **spec-compliant**, and **production-ready**.

---

## 🧭 Rule Enforcement Tiers

ทุก rule ในไฟล์นี้จัดระดับตามนี้ — ใช้ตัดสินใจว่าอะไรต้อง block ทันที อะไรรอ review ได้:

### 🔴 Tier 1 — CRITICAL (CI BLOCKER)

บังคับอัตโนมัติ ผ่าน CI/CD + runtime — **ผิดแล้ว build fail ทันที:**

- Security (Auth, RBAC, Validation)
- UUID Strategy (ADR-019) — ห้าม `parseInt` / `Number` / `+` บน UUID
- Database correctness — ตรวจ schema ก่อนเขียน query เสมอ
- File upload security (ClamAV + whitelist)
- AI validation boundary (ADR-018)
- Forbidden patterns: `any`, `console.log`, UUID misuse

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

ตรวจใน PR review — ไม่ block build แต่ต้องแก้ก่อน merge:

- Architecture patterns (thin controller, business logic ใน service)
- Test coverage (80%+ business logic, 70%+ backend overall)
- Cache invalidation
- Naming conventions

### 🟢 Tier 3 — GUIDELINES

Best practice — ทำตามถ้าทำได้ ไม่ block:

- Code style / formatting (Prettier จัดให้)
- Comment completeness
- Minor optimizations

---

## 🏗️ Project Overview

**LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System)**
ระบบบริหารจัดการเอกสารโครงการก่อสร้างท่าเรือแหลมฉบังระยะที่ 3
**Version:** 1.8.3 (Enforcement Tiers Added) | **Status:** UAT In Progress, Security Hardened (2026-03-19)
| Area          | Status                 | Notes                                                  |
| ------------- | ---------------------- | ------------------------------------------------------ |
| Backend       | ✅ Production Ready     | NestJS 11, Express v5, 0 Vulnerabilities               |
| Frontend      | ✅ Quality Hardened     | Next.js 16.2.0, React 19.2.4, 0 `any`, 0 `console.log` |
| Database      | ✅ Schema v1.8.0 Stable | MariaDB 11.8, No-migration (ADR-009)                   |
| Documentation | ✅ 10/10 Gaps Closed    | Product Vision → Release Policy                        |
| AI Migration  | 🔄 Pre-migration Setup  | n8n + Ollama (ADR-017/018)                             |
| Testing       | 🔄 UAT In Progress      | Per `01-05-acceptance-criteria.md`                     |
| Deployment    | 📋 Pending Go-Live Gate | Blue-Green, QNAP Container Station                     |
| ADR-019 UUID  | ✅ All Phases Complete  | Phase 5.4 done — all UUID FK issues resolved           |
**Domain:** `np-dms.work`

---

## 💻 Tech Stack (Exact Versions from repo)

### Backend

- **NestJS 11** (Express v5, Modular Architecture, 18 modules)
- **TypeORM** + **MariaDB 11.8**
- **Redis 7.2** — BullMQ (Queues) + `cache-manager-redis-store@3.0.1` (Caching)
- **Elasticsearch 9.3.4** — Full-text search
- **JWT + Passport** — Authentication
- **CASL** — 4-Level RBAC Authorization (Global / Organization / Project / Contract)
- **ClamAV** — Virus Scanning on every file upload
- **Helmet.js** — HTTP Security Headers
- **Nodemailer 8.0.3** — Email delivery
- **Swagger** — API documentation at `/api`

### Frontend

- **Next.js 16.2.0** (App Router + `proxy.ts`) + **React 19.2.4**
- **Tailwind CSS 3.4.3** + **Shadcn/UI**
- **TanStack Query** — **Server State only**
- **Zustand** — **Client State only**
- **React Hook Form 7.71.2** + **Zod 4.3.6** + **@hookform/resolvers 3.9.0** — **Form State only**
- **Axios** — HTTP client

### Tooling & Testing

- **pnpm@10.32.1** — Package manager (monorepo workspace)
- **Vitest 4.1.0** — Unit & Integration tests
- **Playwright** — E2E tests
- **ESLint 9.39.1** — Linting
- **Prettier** — Formatting

### Notifications

- BullMQ Queue → Email (Nodemailer 8.0.3) / LINE Notify / In-App

### AI / Migration

- **Ollama** (`llama3.2:3b` / `mistral:7b`) — Admin Desktop ONLY (i9-9900K, RTX 2060 SUPER 8GB, 32GB RAM)
- **n8n** — Automation & Migration Orchestration (QNAP)
- **Tika** — Document parsing (QNAP)

### Security Overrides (pnpm overrides active in root `package.json`)

- 30+ security overrides active (`multer@>=2.1.1`, `undici@>=7.24.0`, `axios@>=1.13.5`, etc.)
- All 52 vulnerabilities resolved as of 2026-03-19 (27 high + 20 moderate + 5 low)

---

## 🗂️ Key Spec Files (Always Check Before Writing Code)

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others
| เอกสาร                    | Path (relative to `specs/`)                                          | ใช้เมื่อ                               |
| ------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| **Glossary**              | `00-Overview/00-02-glossary.md`                                      | ตรวจคำศัพท์ Domain ก่อนเขียนเสมอ         |
| **Schema Tables**         | `03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`              | ก่อนเขียน Query ทุกครั้ง                 |
| **Data Dictionary**       | `03-Data-and-Storage/03-01-data-dictionary.md`                       | ตรวจ Field Meaning + Business Rules |
| **Seed Permissions**      | `03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql`              | ตรวจ CASL Permission Matrix         |
| **Edge Cases (37 rules)** | `01-Requirements/01-06-edge-cases-and-rules.md`                      | ป้องกัน Bug ทุก Flow                   |
| **Migration Scope**       | `03-Data-and-Storage/03-06-migration-business-scope.md`              | งาน Migration Bot (20K docs)        |
| **Release Policy**        | `04-Infrastructure-OPS/04-08-release-management-policy.md`           | ก่อน Deploy / Hotfix                 |
| **UAT Criteria**          | `01-Requirements/01-05-acceptance-criteria.md`                       | ตรวจความสมบูรณ์ Feature               |
| **UUID Implementation**   | `05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md` | ADR-019 UUID Migration (Phase 1–6)  |
| **Backend Guidelines**    | `05-Engineering-Guidelines/05-02-backend-guidelines.md`              | NestJS patterns & best practices    |
| **Frontend Guidelines**   | `05-Engineering-Guidelines/05-03-frontend-guidelines.md`             | Next.js patterns & best practices   |
| **Testing Strategy**      | `05-Engineering-Guidelines/05-04-testing-strategy.md`                | Coverage goals & test patterns      |
| **ADR-009 DB Strategy**   | `06-Decision-Records/ADR-009-db-strategy.md`                         | Schema Change Process               |
| **ADR-018 AI Boundary**   | `06-Decision-Records/ADR-018-ai-boundary.md`                         | AI/Ollama Integration Rules         |
| **ADR-019 Hybrid ID**     | `06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`          | Hybrid ID Strategy (INT + UUIDv7)   |

### Specs Directory Structure (Brief)

```
specs/
├── 00-Overview/          # Product Vision, Glossary, KPI Baseline, Training Plan, Stakeholder
├── 01-Requirements/      # User Stories (27), UAT Criteria, UI Wireframes (26), Edge Cases (37)
│   └── 01-02-business-rules/   # กฎธุรกิจที่ห้ามละเมิด
│   └── 01-03-modules/          # Spec ของแต่ละ Feature module
├── 02-Architecture/      # System Context, Software Architecture, Network, API Design
├── 03-Data-and-Storage/  # Schema v1.8.0 (3 files), Seed Data, Data Dictionary, Migration Scope
├── 04-Infrastructure-OPS/# Docker, Monitoring, Deployment, Incident Response, Release Policy
├── 05-Engineering-Guidelines/ # Fullstack, Backend, Frontend, Testing, UUID Implementation
├── 06-Decision-Records/  # 16 ADRs defined (15 with file, ADR-003/004/007 not created)
└── 99-archives/          # ประวัติ tasks เก่า
```

Schema is split — modify the correct file:

- `lcbp3-v1.8.0-schema-01-drop.sql`
- `lcbp3-v1.8.0-schema-02-tables.sql` ← **primary reference for all queries**
- `lcbp3-v1.8.0-schema-03-views-indexes.sql`

> **UUID Storage (MariaDB-specific):** Column type is `uuid UUID NOT NULL DEFAULT UUID()` — MariaDB native UUID, NOT MySQL's `BINARY(16)` + `UUID_TO_BIN()`/`BIN_TO_UUID()`. No transformer needed. `x.uuid` in Views directly (no conversion function).

---

## 📐 ADR Reference (16 defined)

| ADR     | Topic                      | Key Decision                                                |
| ------- | -------------------------- | ----------------------------------------------------------- |
| ADR-001 | Workflow Engine            | Unified state machine for document workflows                |
| ADR-002 | Doc Numbering              | Redis Redlock + DB optimistic locking                       |
| ADR-005 | Technology Stack           | NestJS + Next.js + MariaDB + Redis                          |
| ADR-006 | Redis Caching              | Cache strategy and invalidation patterns                    |
| ADR-008 | Email Notification         | BullMQ queue-based email/LINE/in-app                        |
| ADR-009 | DB Strategy                | No TypeORM migrations — modify schema SQL directly          |
| ADR-010 | Logging/Monitoring         | Prometheus + Loki + Grafana stack                           |
| ADR-011 | App Router                 | Next.js App Router with RSC patterns                        |
| ADR-012 | UI Components              | Shadcn/UI component library                                 |
| ADR-013 | Form Handling              | React Hook Form + Zod validation                            |
| ADR-014 | State Management           | TanStack Query (server) + Zustand (client)                  |
| ADR-015 | Deployment                 | Docker Compose + Gitea CI/CD                                |
| ADR-016 | Security                   | JWT + CASL RBAC + Helmet.js + ClamAV                        |
| ADR-017 | Ollama Migration           | Local AI + n8n for legacy data import (~20K docs)           |
| ADR-018 | AI Boundary (Patch 1.8.1)  | AI isolation — no direct DB/storage access                  |
| ADR-019 | Hybrid Identifier Strategy | INT PK (internal) + UUIDv7 MariaDB native UUID (public API) |

---

## 🆔 Identifier Strategy (ADR-019) — CRITICAL

### Rule Summary

- **Internal / DB FK:** `INT AUTO_INCREMENT` (Primary Key) — never exposed
- **Public API / URL:** `UUIDv7` stored as MariaDB native `UUID` type (auto-stored as BINARY(16), no transformer needed)
- Read `05-07-hybrid-uuid-implementation-plan.md` before any UUID-related work.

### ✅ Phase 5.4 — COMPLETED (2026-03-21)

All UUID FK issues resolved — no more `parseInt()` on UUID values:

- `frontend/components/correspondences/form.tsx` ✅ fixed
- `frontend/components/admin/user-dialog.tsx` ✅ fixed
- `frontend/components/numbering/template-tester.tsx` ✅ fixed
- `frontend/app/(dashboard)/rfas/page.tsx` ✅ fixed

### UUID Serialization Behavior (TransformInterceptor)

`TransformInterceptor` uses `instanceToPlain()` — `@Exclude()` and `@Expose()` decorators are active on all responses.
| Entity Type        | Behavior                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| All entities       | INT `id` has `@Exclude()` → **never appears in API response**          |
| Project / Contract | `uuid` has `@Expose({ name: 'id' })` → response has `id` = UUID string |
| Other entities     | Separate `uuid` field → response has `uuid`, no `id`                   |

### UUID Patterns (Backend Controller)

```typescript
// ✅ ถูกต้อง — UUID param
@Get(':uuid')
findOne(@Param('uuid', ParseUuidPipe) uuid: string) { ... }
// ❌ ผิด — INT param บน public route
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) { ... }
```

### UUID Patterns (Backend DTO — FK References)

```typescript
// ✅ ถูกต้อง — รับ UUID จาก frontend, resolve เป็น INT ใน controller
@IsUUID()
projectUuid!: string;
@IsOptional()
@IsInt()
projectId?: number; // resolved internally, never from client
// ❌ ผิด — frontend ไม่มี INT id (ถูก @Exclude() แล้ว)
@IsInt()
projectId!: number;
```

### UUID Patterns (Frontend — Select/Form)

```typescript
// ✅ ถูกต้อง
onValueChange={(v) => setValue("projectUuid", v)}
// ❌ ผิด — parseInt บน UUID string ได้ค่าผิดเสมอ
onValueChange={(v) => setValue("projectId", parseInt(v))}
```

---

## 🛡️ Security Rules (Non-Negotiable)

1. **Idempotency:** All critical `POST` / `PUT` / `PATCH` MUST validate `Idempotency-Key` header.
2. **Two-Phase File Upload:** Upload → Temp Storage → Commit → Permanent Storage.
3. **Race Conditions:** Redis Redlock + TypeORM `@VersionColumn` for Document Numbering.
4. **Validation:** Zod (frontend) + class-validator (backend DTO) — no unvalidated inputs.
5. **Password:** bcrypt 12 salt rounds. Min 8 chars, upper + lower + number + special. Rotate every 90 days.
6. **Rate Limiting:** `ThrottlerGuard` on all auth endpoints.
7. **File Upload Policy:** Whitelist: PDF, DWG, DOCX, XLSX, ZIP. Max: 50MB. ClamAV scans every file.
8. **AI Isolation (ADR-018):**

- Ollama runs on Admin Desktop ONLY — NEVER on QNAP/production.
- AI: NO direct DB access, NO write to `/uploads`.
- AI input/output: **JSON only**.
- All AI-triggered writes → DMS REST API → DB.

---

## 📐 TypeScript Rules

- **Strict Mode** — all strict checks enforced.
- **ZERO `any` types** — use proper types, generics, or `unknown` + type narrowing.
- **ZERO `console.log`** — NestJS `Logger` service (backend); remove before commit (frontend).

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

ตรวจใน PR review — ไม่ block build แต่ต้องแก้ก่อน merge:

- Architecture patterns (thin controller, business logic ใน service)
- Test coverage (80%+ business logic, 70%+ backend overall)
- Cache invalidation
- **Naming conventions** — ดูรายละเอียดที่ "🚨 Naming Conventions Pain Point" ด้านล่าง

### 🟢 Tier 3 — GUIDELINES

Best practice — ทำตามถ้าทำได้ ไม่ block:

- Code style / formatting (Prettier จัดให้)
- Comment completeness
- Minor optimizations

---

## � Naming Conventions Pain Point (เรื่องที่ผิดบ่อยที่สุด)

**สถานะ:** พบ violations จำนวนมากใน codebase — ต้อง fix ก่อน merge เสมอ

**ข้อตกลงหลัก:**

| Target                  | Convention  | Example                     |
| ----------------------- | ----------- | --------------------------- |
| **Files/Folders**       | kebab-case  | `user-service.ts`           |
| **Classes**             | PascalCase  | `UserService`               |
| **Variables/Functions** | camelCase   | `firstName`, `getUserInfo`  |
| **DB Columns**          | snake_case  | `user_id`, `created_at`     |
| **Boolean vars**        | verb + noun | `isActive`, `hasPermission` |
| **Code**                | English     | All identifiers in English  |
| **Comments/Docs**       | Thai        | ความคิดเห็นและเอกสารใช้ภาษาไทย |

**❌ Common Violations พบบ่อย:**

```typescript
// ไฟล์: ใช้ PascalCase (ผิด) แทน kebab-case (ถูก)
// ❌ 1701676800000-V1_5_1_Schema_Update.ts
// ✅ 1701676800000-v1-5-1-schema-update.ts

// DTOs/Entities: ใช้ snake_case (ผิด) แทน camelCase (ถูก)
// ❌ document_number!: string;
// ✅ documentNumber!: string;

// ❌ temp_attachment_id?: number;
// ✅ tempAttachmentId?: number;

// ❌ project_id!: number;
// ✅ projectId!: number;

// Interface properties ต้อง camelCase เสมอ
// ❌ workflow_code: string;
// ✅ workflowCode: string;
```

**⚠️ ข้อควรระวัง:**

- **DB Columns** ใช้ snake_case แต่ต้องอยู่ใน `@Column({ name: 'snake_case' })` decorator เท่านั้น
- **Property names ใน TypeScript** ต้อง camelCase เสมอ — ไม่ว่าจะเป็น DTO, Entity, หรือ Interface
- **Form field names** ใน React Hook Form + Zod ต้อง camelCase
- **Type definitions** ทั้งหมดต้อง camelCase — ไม่มีข้อยกเว้น

---

## 🏷️ Domain Terminology (Glossary)

อ้างอิง `specs/00-Overview/00-02-glossary.md` เสมอ — ใช้ term ผิดจะทำให้ spec ไม่ตรง
| ✅ ใช้ (Correct)     | ❌ ห้ามใช้ (Wrong)                             |
| ------------------ | ------------------------------------------- |
| Correspondence     | Letter, Communication, Document (generic)   |
| RFA                | Approval Request, Submit for Approval       |
| Transmittal        | Delivery Note, Cover Letter                 |
| Circulation        | Distribution, Routing                       |
| Shop Drawing       | Construction Drawing (generic)              |
| Contract Drawing   | Design Drawing, Blueprint                   |
| Workflow Engine    | Approval Flow, Process Engine               |
| Document Numbering | Document ID, Auto Number                    |
| RBAC               | Permission System, Access Control (generic) |

---

## 🏛️ Architecture Rules

### Backend (NestJS) — 18 Modules

```
auth | user | project | correspondence | rfa | drawing | workflow-engine |
document-numbering | transmittal | circulation | search | dashboard |
notification | monitoring | master | organizations | json-schema | config
```

- **Modular Architecture** — one module per domain.
- Business logic in **Services only** — Controllers are thin (validate → delegate).
- **NO SQL Triggers** — all logic in NestJS services.
- Every protected route: `@UseGuards(JwtAuthGuard, CaslGuard)` + `@Roles()`.
- `@Roles()` must align with CASL matrix in `seed-permissions.sql`.
- All file operations through `StorageService` — never directly.
- Notifications via BullMQ — NEVER send inline.
- NEVER use `req: any` — use `RequestWithUser` interface.

### Frontend (Next.js) — 15 Component Groups

```
ui/ | layout/ | common/ | correspondences/ | rfas/ | drawings/ |
workflows/ | numbering/ | dashboard/ | search/ | transmittals/ |
circulations/ | admin/ | auth/ | notifications/
```

- **App Router** — Server Components by default; Client Components only when necessary.
- All API calls through `proxy.ts` — NEVER call backend directly from client.
- **TanStack Query** — server state (fetching, caching, invalidation).
- **Zustand** — UI/client state (modals, sidebar, selections).
- **React Hook Form + Zod** — all forms; no uncontrolled inputs.
- No `console.log`, no `any`, no `parseInt()` on UUIDs — remove before commit.

---

## 🗄️ Database Rules (ADR-009)

- **NO TypeORM migrations** — schema changes go directly into the SQL schema files.
- **NEVER invent table names or columns** — only use what is in `schema-02-tables.sql`.
- Always verify against schema before writing any query or TypeORM entity.
- Check `03-01-data-dictionary.md` for field meanings and business rules.

---

## 🤖 AI / n8n Rules (ADR-017 & ADR-018)

- Ollama models: `llama3.2:3b` (fast tasks) / `mistral:7b` (complex extraction).
- n8n orchestrates all migration workflows on QNAP (`n8n-workflow-lcbp3.json`).
- AI output must be validated JSON — schema-validate before any DB write via API.
- Migration Bot token: IP Whitelist + 7-day Expiry + REVOKE immediately after migration.
- **DO NOT** start Legacy Migration without Go/No-Go Gate #1 approval.
- Migration scope: ~20,000 documents in 3 Tiers — Tier 1 first (2,000 critical docs).

---

## 🧪 Testing Standards

### Coverage Goals

| Layer            | Target | Priority Areas                                |
| ---------------- | ------ | --------------------------------------------- |
| Backend overall  | 70%+   | —                                             |
| Business Logic   | 80%+   | Services, Workflow Engine, Document Numbering |
| Controllers      | 70%+   | Happy path + error cases                      |
| Utilities        | 90%+   | Helpers, Transformers, Guards                 |
| Frontend overall | 60%+   | Components, Hooks, API clients                |

### Health Check Endpoints

```
GET /health          — Overall system health
GET /health/db       — MariaDB connectivity
GET /health/redis    — Redis connectivity
```

### Test Commands

```bash
# Backend
pnpm --filter backend test          # Unit tests
pnpm --filter backend test:e2e      # E2E tests
pnpm --filter backend test:cov      # Coverage report
# Frontend
pnpm --filter frontend test         # Unit tests (Vitest)
pnpm --filter frontend test:e2e     # E2E tests (Playwright)
```

### Feature Testing Checklist (ก่อน PR)

#### Backend

- [ ] Unit test: Service business logic (min 80% coverage)
- [ ] Integration test: Controller + Guard + DTO validation
- [ ] E2E test: Happy path + 2 edge cases จาก `01-06-edge-cases.md`
- [ ] Security test: Unauthorized access, SQL injection, XSS

#### Frontend

- [ ] Component test: Render + interaction (Vitest + Testing Library)
- [ ] Form test: Validation success/failure cases
- [ ] E2E test: Critical user journey (Playwright)
- [ ] Accessibility: Keyboard nav + screen reader basics

#### Before Commit

- [ ] `pnpm lint` → 0 errors
- [ ] `pnpm test:cov` → ผ่านเกณฑ์
- [ ] `pnpm build` → 0 warnings
- [ ] UUID pattern ตรวจสอบแล้ว (ไม่มี parseInt บน UUID)

---

## 🌿 Git Conventions

### Commit Message Format

```
<type>(<scope>): <description>
[optional body]
[optional footer: Refs #issue]
```

| Type       | ใช้เมื่อ                                 |
| ---------- | ------------------------------------- |
| `feat`     | เพิ่มฟีเจอร์ใหม่                           |
| `fix`      | แก้ bug                                |
| `refactor` | ปรับโครงสร้างโค้ด ไม่เปลี่ยน behavior       |
| `docs`     | แก้ไขเอกสาร                            |
| `test`     | เพิ่ม/แก้ test                           |
| `chore`    | งาน infra, config, dependency updates |
| `style`    | Formatting, linting (ไม่เปลี่ยน logic)   |
| `spec`     | แก้ไข specs/ documents                 |
| `adr`      | เพิ่ม/แก้ไข Architecture Decision Record |

**ตัวอย่าง:**

```
feat(correspondence): add create correspondence endpoint
fix(uuid): remove parseInt on projectId in rfas/page.tsx
spec(requirements): update edge cases for drawing workflow
adr(019): add UUID serialization behavior notes
```

### Branch Naming

```
feature/<description>              # ฟีเจอร์ใหม่
fix/<issue-number>-<description>   # แก้ bug
spec/<category>/<description>      # แก้ specs
adr/<number>-<description>         # ADR ใหม่/แก้ไข
refactor/<description>             # Refactor
```

**ตัวอย่าง:**

```
feature/correspondence-cc-support
fix/23-uuid-parseInt-rfas-page
spec/requirements/update-correspondence-workflow
adr/019-uuid-serialization-behavior
```

---

## 🌊 Windsurf Workflows

`.windsurf/workflows/` — ใช้สำหรับ repeatable / complex tasks เช่น:

- ADR-019 UUID pattern verification
- Spec review & gap analysis
- Security audit checklist
- Release gate verification

เมื่อ task ซับซ้อนและทำซ้ำได้ ให้ดู `.windsurf/workflows/` ก่อนเขียน code ใหม่

---

## 🚀 Deployment Rules (ADR-015)

- Docker Compose on **QNAP Container Station** (production).
- **NO `.env` files in production** — secrets in `docker-compose.yml` environment section directly.
- Blue-Green deployment strategy.
- CI/CD via **Gitea** (QNAP) + **Gitea Runner / act_runner** (ASUSTOR).
- **DO NOT deploy** without completing all Release Gates per `04-08-release-management-policy.md`.

---

## 🚫 Forbidden Actions

| ❌ Forbidden                                     | ✅ Correct Approach                                        |
| ----------------------------------------------- | --------------------------------------------------------- |
| SQL Triggers for business logic                 | NestJS Service methods                                    |
| `.env` files in production                      | `docker-compose.yml` environment section                  |
| TypeORM migration files                         | Edit schema SQL directly (ADR-009)                        |
| Inventing table/column names                    | Verify against `schema-02-tables.sql`                     |
| `any` TypeScript type                           | Proper types / generics / `unknown` + narrowing           |
| `console.log` in committed code                 | NestJS Logger (backend) / remove (frontend)               |
| `req: any` in controllers                       | `RequestWithUser` typed interface                         |
| `parseInt()` on UUID values                     | Use UUID string directly (ADR-019)                        |
| Exposing INT PK in API responses or URLs        | UUIDv7 (ADR-019)                                          |
| AI accessing DB or storage directly             | AI → DMS API → DB (ADR-018)                               |
| Direct file operations bypassing StorageService | `StorageService` for all file moves                       |
| Inline email/notification sending               | BullMQ queue job                                          |
| Generic domain terms (Letter, Blueprint, etc.)  | Correct term from Glossary (`00-02-glossary.md`)          |
| Deploying without Release Gates                 | Complete `04-08-release-management-policy.md` gates       |
| Starting migration without Go/No-Go Gate #1     | Gate approval first (`03-06-migration-business-scope.md`) |
| Closing UAT without all Acceptance Criteria ✅   | Full sign-off per `01-05-acceptance-criteria.md`          |
| Modifying Migration Bot token scope             | IP Whitelist + 7-day expiry only                          |
| OWASP Top 10 violations                         | Security checklist before every PR                        |

---

## 🔄 Development Flow (Tiered)

เลือก flow ตามประเภทงาน — ไม่ต้องอ่าน spec ทั้งหมดทุกครั้ง:

### 🔴 Critical Work — DB / API / Security / Workflow Engine

**MUST ทำครบทุก step:**

1. **Glossary check** — ตรวจคำศัพท์ domain ใน `00-02-glossary.md`
2. **Read the spec** — เลือกจาก Key Spec Files table
3. **Check schema** — verify table/column ใน `schema-02-tables.sql`
4. **Check data dictionary** — ยืนยัน field meanings + business rules
5. **Scan edge cases** — `01-06-edge-cases-and-rules.md` (37 rules)
6. **Check ADRs** — ตรวจแนวทางตรงกับ decisions (esp. ADR-009, ADR-018, ADR-019)
7. **Write code** — TypeScript strict, no `any`, no `console.log`, UUID ไม่ expose

### 🟡 Normal Work — UI / Feature / Integration

- ดู existing patterns ในโค้ดที่มีอยู่
- ตรวจ spec เฉพาะ module ที่เกี่ยวข้อง
- ไม่ต้องอ่าน spec ทั้งหมด

### 🟢 Quick Fix — Bug Fix / Typo / Style

- แก้โดยตรง
- เพิ่ม minimal test ถ้าแก้ logic
- ตรวจ forbidden patterns ก่อน commit

---

## 🎯 Windsurf Context-Aware Triggers

เมื่อผู้ใช้ถามเกี่ยวกับ... ให้ตรวจสอบไฟล์เหล่านี้ก่อนตอบ
| คำถาม/คำสั่ง             | ไฟล์ที่ต้องตรวจสอบก่อน                                       | คำตอบที่คาดหวัง                                                |
| -------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| "สร้าง API ใหม่"       | `05-02-backend-guidelines.md`, `schema-02-tables.sql`   | NestJS Controller + Service + DTO + CASL Guard             |
| "แก้ฟอร์ม frontend"    | `05-03-frontend-guidelines.md`, `01-06-edge-cases.md`   | RHF+Zod + TanStack Query + Thai comments                   |
| "เพิ่ม field ใหม่"      | `ADR-009`, `data-dictionary.md`, `schema-02-tables.sql` | แก้ SQL โดยตรง + อัพเดท Data Dictionary + Entity             |
| "ตรวจสอบ UUID"       | `ADR-019`, `05-07-hybrid-uuid-implementation-plan.md`   | UUIDv7 MariaDB native UUID + TransformInterceptor behavior |
| "สร้าง migration"     | `ADR-009`, `03-06-migration-business-scope.md`          | แก้ SQL schema โดยตรง + n8n workflow                        |
| "ตรวจสอบ permission" | `seed-permissions.sql`, `ADR-016`                       | CASL 4-Level RBAC matrix                                   |
| "deploy production"  | `04-08-release-management-policy.md`, `ADR-015`         | Release Gates + Blue-Green strategy                        |
| "เพิ่ม test"           | `05-04-testing-strategy.md`                             | Coverage goals + test patterns                             |

---

## 🧩 Code Snippets (Windsurf Auto-Suggest)

### Backend DTO Pattern

```typescript
// [dto-new] → สร้าง DTO ใหม่พร้อม validator
@IsUUID()
@ApiProperty({ description: 'Project UUID (public)' })
projectUuid!: string;


@IsOptional()
@IsInt()
@ApiProperty({ required: false, description: 'Internal project ID' })
projectId?: number; // resolved internally, never from client
```

### Frontend Form Pattern

```typescript
// [form-rhf-zod] → สร้าง form schema + hook
const schema = z.object({
  projectUuid: z.string().uuid('รหัสโครงการไม่ถูกต้อง'),
  title: z.string().min(3, 'กรุณากรอกหัวข้ออย่างน้อย 3 ตัวอักษร'),
});
const form = useForm({ resolver: zodResolver(schema) });
```

### UUID Safe Pattern

```typescript
// [uuid-safe] → ตรวจสอบ UUID ก่อนใช้
const safeUuid = (val: string | number): string => {
  if (typeof val === 'number') {
    Logger.warn(`UUID received as number: ${val}`);
    return String(val); // หรือ throw error ตาม policy
  }
  return val;
};
```

### Backend Error Handling Pattern

```typescript
// [backend-error] → Error handling มาตรฐาน
if (!entity) {
  this.logger.warn(`Entity not found: ${uuid}`, 'Service.findOne');
  throw new NotFoundException(`Resource with UUID ${uuid} not found`);
}
```

### Frontend Query Pattern

```typescript
// [frontend-query] → TanStack Query v5 มาตรฐาน
const { data, error, isLoading } = useQuery({
  queryKey: ['correspondence', uuid],
  queryFn: () => api.get(`/correspondences/${uuid}`),
});
// v5: onError ถูกลบออกจาก useQuery — จัดการ error ผ่าน return value
if (error) toast.error('ไม่สามารถโหลดข้อมูลได้');
```

### Redis Cache Pattern

```typescript
// [redis-cache] → Cache-Aside Pattern
const cacheKey = `correspondence:${uuid}`;
const cached = await this.cacheManager.get(cacheKey);
if (cached) return cached;
const entity = await this.repo.findOneBy({ uuid });
if (entity) {
  await this.cacheManager.set(cacheKey, entity, 300); // 5 นาที
}
return entity;
```

---

## 🚨 Error Handling & Logging Standards

### Backend (NestJS)

```typescript
// ✅ ถูกต้อง — ใช้ Logger + HttpException
if (!entity) {
  this.logger.warn(`Entity not found: ${uuid}`, 'Service.findOne');
  throw new NotFoundException(`Resource with UUID ${uuid} not found`);
}
// ❌ ผิด — console.log หรือ return null
console.log('not found'); // ❌
return null; // ❌ ทำให้ caller ต้องเช็คเอง
```

### Frontend (Next.js)

```typescript
// ✅ ถูกต้อง — ใช้ TanStack Query v5 error handling
const { data, error, isLoading } = useQuery({
  queryKey: ['correspondence', uuid],
  queryFn: () => api.get(`/correspondences/${uuid}`),
});
// v5: onError removed from useQuery — handle via error return value
if (error) {
  // แสดง toast + fallback UI
  toast.error('ไม่สามารถโหลดข้อมูลได้');
}
```

### Error Response Standard (Backend)

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found",
  "timestamp": "2026-03-21T10:30:00.000Z",
  "path": "/api/correspondences/:uuid",
  "traceId": "req-abc123" // สำหรับติดตามใน Loki
}
```

---

## 🌐 Thai Language & i18n Guidelines

### Code Comments & Docs

- ✅ Comments: เขียนเป็นภาษาไทย (เพื่อความเข้าใจทีม)
- ✅ JSDoc: ใช้ภาษาไทยอธิบาย business logic
- ✅ Error messages: เก็บเป็น key ใน i18n file, ไม่ hardcode

### i18n Structure (frontend)

```
locales/
├── th/
│   ├── common.json      # ข้อความทั่วไป
│   ├── errors.json      # Error messages
│   ├── forms.json       # Form labels & validation
│   └── modules/
│       ├── correspondence.json
│       └── rfa.json
└── en/                  # Reserved for future
```

### Validation Messages (Zod)

```typescript
// ✅ ถูกต้อง — ใช้ key อ้างอิง
z.string().min(3, { message: 'errors:min_length_3' });
// แล้ว resolve ใน frontend ผ่าน i18n hook

// ❌ ผิด — hardcode ภาษาไทยใน schema
z.string().min(3, 'กรุณากรอกอย่างน้อย 3 ตัวอักษร'); // ทำให้ทดสอบยาก
```

---

## ⚡ Performance & Caching Patterns

### Redis Cache Patterns (ADR-006)

```typescript
// ✅ Cache-Aside Pattern สำหรับข้อมูลอ่านบ่อย
async findOne(uuid: string) {
  const cacheKey = `correspondence:${uuid}`;
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached;

  const entity = await this.repo.findOneBy({ uuid });
  if (entity) {
    await this.cacheManager.set(cacheKey, entity, 300); // 5 นาที
  }
  return entity;
}


// ✅ Cache Invalidation เมื่อแก้ไขข้อมูล
async update(uuid: string, dto: UpdateDto) {
  // ... update logic
  await this.cacheManager.del(`correspondence:${uuid}`);
  await this.cacheManager.del('correspondences:list'); // ลบ list cache
}
```

### Query Optimization Checklist

- [ ] ใช้ `select: [...]` เพื่อโหลดเฉพาะฟิลด์ที่ต้องการ
- [ ] ใช้ `relations: [...]` แทน JOIN ซับซ้อนเมื่อไม่จำเป็น
- [ ] ตรวจสอบ N+1 problem ด้วย `@UseInterceptors(LoggingInterceptor)`
- [ ] ใช้ `take/skip` สำหรับ pagination เสมอ

---

## 📦 Infrastructure Quick Reference

### QNAP NAS (Container Station) — Production

| Service              | Notes                           |
| -------------------- | ------------------------------- |
| DMS Frontend         | Next.js 16.2.0 + React 19.2.4   |
| DMS Backend          | NestJS 11 + Express v5          |
| MariaDB 11.8         | Schema v1.8.0                   |
| Redis 7.2            | BullMQ + Cache                  |
| Elasticsearch 9.3.4  | Full-text search                |
| n8n + n8n-db         | Automation & Migration          |
| Nginx Proxy Manager  | Reverse proxy + SSL termination |
| Tika                 | Document parsing                |
| Gitea                | Source code management          |
| RocketChat           | Team communication              |
| cAdvisor + exporters | Container metrics               |

### ASUSTOR NAS (Portainer) — Monitoring Hub

| Service         | Notes                           |
| --------------- | ------------------------------- |
| Grafana         | Dashboards + KPI visualization  |
| Prometheus      | Metrics (scrapes QNAP)          |
| Loki + Promtail | Log aggregation                 |
| Uptime-Kuma     | Service availability monitoring |
| Gitea Runner    | CI/CD (act_runner)              |
| Docker Registry | Private image registry          |
| Cloudflared     | External tunnel                 |
| cAdvisor        | Container metrics               |

### Admin Desktop — AI Processing ONLY

| Spec    | Value                                            |
| ------- | ------------------------------------------------ |
| CPU     | Intel i9-9900K                                   |
| RAM     | 32GB                                             |
| GPU     | RTX 2060 SUPER 8GB                               |
| Service | Ollama (`llama3.2:3b` / `mistral:7b`)            |
| Rule    | **NEVER on QNAP** — Admin Desktop ONLY (ADR-018) |

## **Network:** Internal VLAN — QNAP metrics scraped by ASUSTOR Prometheus

## 📜 .windsurfrules Change Log

| Version | Date       | Changes                                                                                                               | Updated By     |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.8.4   | 2026-03-24 | Phase 5.4→✅ DONE, Tailwind 3.4.3, ADR count(16), MariaDB UUID note, TanStack v5 patterns, formatting fix              | Windsurf AI    |
| 1.8.3   | 2026-03-21 | + Rule Enforcement Tiers (🔴🟡🟢), + Tiered Development Flow                                                             | Human Dev + AI |
| 1.8.2   | 2026-03-21 | + Context Triggers, + Code Snippets, + Error Handling, + i18n, + Performance, + Testing Checklist, + Prompt Templates | Human Dev + AI |
| 1.8.1   | 2026-03-21 | + ADR-019 UUID patterns, + Phase 5.4 pending files                                                                    | Claude Sonnet  |
| 1.8.0   | 2026-03-19 | + Security overrides, + UAT criteria reference                                                                        | Human Dev      |
| 1.7.2   | 2026-03-15 | + AI Boundary rules (ADR-018)                                                                                         | Gemini Pro     |

### วิธีอัพเดทไฟล์นี้

1. แก้ไขในส่วนที่เกี่ยวข้อง
2. อัพเดทตาราง Change Log ด้านบน
3. เพิ่ม version number ใน header
4. Commit ด้วย message: `spec(windsurfrules): bump to v1.8.4 - <brief description>`

---

## ✅ Quick Reference Checklist (ก่อน Commit ทุกครั้ง)

- [ ] UUID pattern ตรวจสอบแล้ว (ไม่มี parseInt บน UUID)
- [ ] No `any` types ใน TypeScript
- [ ] No `console.log` ในโค้ดที่ commit
- [ ] Comments เป็นภาษาไทย
- [ ] Code identifiers เป็นภาษาอังกฤษ
- [ ] Schema เปลี่ยนแก้ SQL โดยตรง (ไม่ใช่ migration)
- [ ] Test coverage ผ่านเกณฑ์ (Backend 70%+, Business Logic 80%+)
- [ ] ADR ที่เกี่ยวข้องตรวจสอบแล้ว (esp. ADR-009, ADR-018, ADR-019)
- [ ] Glossary terms ใช้ถูกต้อง
- [ ] Error handling ครบถ้วน (Logger + HttpException)
- [ ] i18n keys ใช้แทน hardcode text
- [ ] Cache invalidation มีเมื่อแก้ไขข้อมูล
- [ ] Security checklist ผ่าน (OWASP Top 10)
