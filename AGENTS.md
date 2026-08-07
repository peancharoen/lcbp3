# NAP-DMS Project Context & Rules

- For: Windsurf Cascade (and compatible: Codex CLI, opencode, Amp, Antigravity, AGENTS.md tools)
- Version: 1.9.13 | Last synced from repo: 2026-07-30
- Repo: [https://git.np-dms.work/np-dms/lcbp3](https://git.np-dms.work/np-dms/lcbp3)
- Skill pack: `.agents/skills/` (v1.9.0, 21 skills) — see [`skills/README.md`](./.agents/skills/README.md) + [`skills/_LCBP3-CONTEXT.md`](./.agents/skills/_LCBP3-CONTEXT.md)

---

## 📦 Project Memory Override

For this repository, use project memory from:
`memory/project-memory-override.md`

**Before using global Codex memory**, read this project memory file first when the task depends on prior repo context, conventions, decisions, or rollout history.

If project memory conflicts with global memory, prefer `memory/project-memory-override.md` for LCBP3-specific facts.

---

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
- **AI Infrastructure:** ADR-023/023A boundary enforcement and pipeline usage; ADR-040 OCR sidecar contract (amends ADR-035); ADR-042 OCR text persistence + Sandbox Project
- **AI Runtime Layer:** ADR-024 Intent Classification, ADR-025 Tool Layer, ADR-026 Chat UI, ADR-027 Admin Console, ADR-032 Typhoon OCR, ADR-033 Active Model & OCR, ADR-036 Sandbox-Production Parity, ADR-037 Prompt Management UX/UI
- **AI Document Ingestion Flow:** [`specs/02-architecture/02-05-ai-document-ingestion-flow.md`](./specs/02-architecture/02-05-ai-document-ingestion-flow.md) — end-to-end walkthrough (Production + Sandbox)
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

→ Full table: [`.agents/rules/12-key-spec-files.md`](./.agents/rules/12-key-spec-files.md)

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others

---

## 📁 Specs Folder Organization

→ Full details: [`.agents/rules/13-specs-folder-organization.md`](./.agents/rules/13-specs-folder-organization.md)

Core: `00-overview/` → `06-Decision-Records/` (permanent) | Feature: `100-Infrastructures/`, `200-fullstacks/`, `300-others/`

---

## 🆔 Identifier Strategy (ADR-019) — CRITICAL

→ Full details: [`.agents/rules/01-adr-019-uuid.md`](./.agents/rules/01-adr-019-uuid.md)

Key rules: Use `publicId` only, NEVER `parseInt()` on UUID, NEVER expose INT `id`.

---

## 🛡️ Security Rules (Non-Negotiable)

→ Full details: [`.agents/rules/02-security.md`](./.agents/rules/02-security.md)

Key: Two-phase upload, ClamAV, RBAC, AI isolation (ADR-023/023A/034), Qdrant `projectPublicId` filter.

---

## 📐 TypeScript Rules & Coding Standards

→ Full details: [`.agents/rules/03-typescript.md`](./.agents/rules/03-typescript.md)

Key: Strict mode, ZERO `any`, ZERO `console.log`, English code/Thai comments, file headers `// File: path`.

---

## 🏷️ Domain Terminology

→ Full glossary: [`.agents/rules/04-domain-terminology.md`](./.agents/rules/04-domain-terminology.md) | `specs/00-overview/00-02-glossary.md`

Key: Correspondence (not Letter), Workflow Engine (not Approval Flow), Document Numbering (not Document ID).

---

## 🚫 Forbidden Actions & Out of Scope

→ Full details: [`.agents/rules/05-forbidden-actions.md`](./.agents/rules/05-forbidden-actions.md)

Includes: Forbidden patterns + Out of Scope (never do without explicit approval).

---

## 🔄 Development Flow (Tiered)

→ Full details: [`.agents/rules/08-development-flow.md`](./.agents/rules/08-development-flow.md)

Tiers: 🔴 Critical (DB/API/Security) → 🟡 Normal (UI/Feature) → 🟢 Quick Fix → 🟢 Specialized (ADR-021/AI Runtime/Migration)

---

## 🎯 Context-Aware Triggers

→ Full table: [`.agents/rules/14-context-aware-triggers.md`](./.agents/rules/14-context-aware-triggers.md)

Maps user requests → spec files to check + expected response.

---

## 🔌 MCP MariaDB Tools

→ Full details: [`.agents/rules/15-mcp-mariadb-tools.md`](./.agents/rules/15-mcp-mariadb-tools.md)

Tools: `mysql_test_connection`, `mysql_show_databases`, `mysql_show_tables`, `mysql_describe_table`, `mysql_query`, `mysql_insert`, `mysql_update`, `mysql_delete`. ❌ No DDL.

---

## 🧠 MCP Memory Tools

→ Full details: [`.agents/rules/16-mcp-memory-tools.md`](./.agents/rules/16-mcp-memory-tools.md)

Knowledge Graph tools: `create_entities`, `create_relations`, `add_observations`, `delete_entities`, `delete_relations`, `delete_observations`, `open_nodes`, `read_graph`, `search_nodes` for long-term context.

---

## 🔴 MCP Redis Tools

→ Full details: [`.agents/rules/17-mcp-redis-tools.md`](./.agents/rules/17-mcp-redis-tools.md)

Tools: `set`, `get`, `delete`, `list`. Debug cache/Redlock/BullMQ. ❌ Don't delete Redlock keys (ADR-002).

---

## 🔍 MCP Qdrant Tools

→ Full details: [`.agents/rules/18-mcp-qdrant-tools.md`](./.agents/rules/18-mcp-qdrant-tools.md)

Tools: `qdrant_list_collections`, `qdrant_collection_info`, `qdrant_scroll`, `qdrant_count`, `qdrant_search`, `qdrant_health`. 🔴 Every query MUST include `projectPublicId` filter (ADR-023A).

---

## 🐙 MCP Gitea Tools

→ Full details: [`.agents/rules/19-mcp-gitea-tools.md`](./.agents/rules/19-mcp-gitea-tools.md)

60+ tools: issues, comments, labels, milestones, topics, pull requests, Gitea Actions (CI/CD), releases, wiki. 🔴 `merge_pull_request` is IRREVERSIBLE — confirm before.

---

## 🌐 MCP Fetch Tools

→ Full details: [`.agents/rules/20-mcp-fetch-tools.md`](./.agents/rules/20-mcp-fetch-tools.md)

Tools: `fetch_html`, `fetch_markdown`, `fetch_txt`, `fetch_json`, `fetch_readable`, `fetch_youtube_transcript`. Web content retrieval for research/docs.

---

## 🎨 MCP StitchMCP Tools

→ Full details: [`.agents/rules/21-mcp-stitch-tools.md`](./.agents/rules/21-mcp-stitch-tools.md)

Tools: project/screen/design-system management + `generate_screen_from_text`, `generate_variants`. ⚠️ Generated code must pass review (ADR-019, TS strict) before production.

---

## 🎭 MCP Playwright Tools

→ Full details: [`.agents/rules/22-mcp-playwright-tools.md`](./.agents/rules/22-mcp-playwright-tools.md)

Browser automation: navigate, click, fill_form, snapshot, console_messages, network_requests, screenshot. Pairs with `check-real-app` + `e2e-testing` skills.

---

## 🛠️ Final Checklists

→ Full details: [`.agents/rules/09-commit-checklist.md`](./.agents/rules/09-commit-checklist.md)

Tier 1 (CI blocker): UUID, RBAC, AI boundary, validation, file upload, error handling.
Tier 2 (code review): File headers, JSDoc, test coverage, cache invalidation, i18n.
Tier 3 (specialized): Workflow, AI integration, performance.
Tier 4 (guidelines): Prettier, comments.

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
- **Data & Storage:** `specs/03-Data-and-Storage/` (canonical schema + `deltas/` incremental SQL per ADR-044)
- **Engineering Guidelines:** `specs/05-Engineering-Guidelines/`
- **Decision Records:** `specs/06-Decision-Records/`
- **Infrastructure:** `specs/04-Infrastructure-OPS/`
- **Agent Skill Pack:** `.agents/skills/` (NestJS/Next.js rules + 21 Speckit & Utility skills)
- **Helper Scripts:** `.agents/scripts/{bash,powershell}/` (audit, validate, prerequisites, setup-plan)

---

## 🔄 Change Log

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Updated By     |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.9.13  | 2026-08-03 | **MCP Rules Sync:** Added 6 new MCP rule files (17-22) covering Redis, Qdrant, Gitea, Fetch, StitchMCP, Playwright servers; fixed MariaDB rule (15) tool name prefixes `mcp1_*` → `mysql_*` and Memory rule (16) verified (no `mcp3_*` prefix); synced rules 17-22 from `.devin/rules/` → `.agents/rules/`; updated `.agents/README.md` architecture tree + MCP servers table; AGENTS.md MCP sections expanded from 2 → 8 servers                                                         | Devin          |
| 1.9.12  | 2026-07-23 | **Refactoring:** Extracted 12 sections to `.agents/rules/` reference files (5 new: 12-16); merged Out of Scope into 05-forbidden-actions.md; AGENTS.md reduced from 756→283 lines (63% reduction); all content preserved in rule files with stub links in AGENTS.md                                                                                                                                                                                                                       | Windsurf AI    |
| 1.9.10  | 2026-06-06 | Added MCP MariaDB Tools section with available tools (test_connection, show_databases, show_tables, describe_table, query, insert, update, delete), usage guidelines for development flow, and safety warnings for DDL operations; Added MCP Memory Tools section with Knowledge Graph management tools (create_entities, create_relations, add_observations, delete_entities, delete_relations, delete_observations, open_nodes, read_graph, search_nodes) for long-term context storage | Windsurf AI    |
| 1.9.9   | 2026-06-13 | ADR-034 canonical model names sync: np-dms-ai:latest / np-dms-ocr:latest; ADR-036 parity prep; model switching and sidecar refs updated                                                                                                                                                                                                                                                                                                                                                   | Codex          |
| 1.9.8   | 2026-06-02 | Added ADR-033 Active Model & OCR Runner Management; implemented Synchronous LLM switches, GPU Memory Auto-release, sidecar `X-API-Key` headers protection; updated Key Spec Files & Specialized Work AI runtime sections                                                                                                                                                                                                                                                                  | Windsurf AI    |
| 1.9.7   | 2026-05-25 | Added ADR-029 Dynamic Prompt Management to Key Spec Files table; fixed gemma4 model name e2b→e4b Q8_0; added Dynamic Prompt context trigger; added ADR-029 to Tier 3 AI checklist; bumped last synced date                                                                                                                                                                                                                                                                                | Windsurf AI    |
| 1.9.6   | 2026-05-22 | Added ADR-024/025/026/027/028 to Key Spec Files table; Tier 3 expanded with AI Runtime Layer + Migration Pipeline tiers; Specialized Work section updated with ADR-024~028 patterns; 6 new Context-Aware Triggers; bumped Last synced date                                                                                                                                                                                                                                                | Windsurf AI    |
| 1.9.5   | 2026-05-18 | **Grill-with-Docs Session:** Domain terminology clarified (Correspondence = all doc types), Tier 3: SPECIALIZED WORK added, Context-Aware Triggers with Status column, Tier-specific Final Checklists                                                                                                                                                                                                                                                                                     | Windsurf AI    |
| 1.9.4   | 2026-05-16 | Added ADR-015 Release Strategy to Key Spec Files table (Blue-Green deployment + release gates)                                                                                                                                                                                                                                                                                                                                                                                            | Human Dev      |
| 1.9.3   | 2026-05-15 | ADR-023A: Model revision — gemma4:9b+Typhoon→gemma4:e2b (2-model stack), BullMQ 2-queue split, RAG full-doc embed, OCR auto-detect, n8n→DMS API boundary, QdrantService multi-tenancy contract                                                                                                                                                                                                                                                                                            | Windsurf AI    |
| 1.9.2   | 2026-05-14 | Consolidated legacy AI ADRs (017, 017B, 018, 020, 022) into master ADR-023: Unified AI Architecture                                                                                                                                                                                                                                                                                                                                                                                       | Antigravity AI |
| 1.9.1   | 2026-05-13 | Added `bugfix` workflow and skill (migrated and improved from `docs/bugfix.md`)                                                                                                                                                                                                                                                                                                                                                                                                           | Windsurf AI    |
| 1.9.0   | 2026-05-03 | Integrated Global TypeScript Coding Standards (Headers, JSDoc, Thai comments, Single Export, No blank lines)                                                                                                                                                                                                                                                                                                                                                                              | Windsurf AI    |
| 1.8.9   | 2026-04-22 | `.agents/skills/` LCBP3-native rebuild (20 skills @ v1.8.9) + `_LCBP3-CONTEXT.md` appendix + `specs/03-Data-and-Storage/deltas/` + AGENTS.md sync                                                                                                                                                                                                                                                                                                                                         | Windsurf AI    |
| 1.8.8   | 2026-04-14 | Workflow attachments (ADR-021) + step-attachment envelope fields                                                                                                                                                                                                                                                                                                                                                                                                                          | Windsurf AI    |
| 1.8.7   | 2026-04-14 | + ADR-021 Workflow Context integration, + ADR-021 Integration Work tier, + Transmittal/Circulation context triggers, updated ADR-020 status                                                                                                                                                                                                                                                                                                                                               | Windsurf AI    |
| 1.8.6   | 2026-04-10 | + DMS Workflow Engine Protocol, + Security & Integrity Audit Protocol, + 2 Context-Aware Triggers, ADR Status column, Forbidden Why column                                                                                                                                                                                                                                                                                                                                                | Human Dev      |
| 1.8.5   | 2026-04-04 | Added ADR-007 error handling, ADR-020 AI integration, updated security rules                                                                                                                                                                                                                                                                                                                                                                                                              | Windsurf AI    |
| 1.8.4   | 2026-03-24 | Phase 5.4→✅ DONE, Tailwind 3.4.3, ADR count(16), MariaDB UUID note                                                                                                                                                                                                                                                                                                                                                                                                                       | Windsurf AI    |
| 1.8.3   | 2026-03-21 | + Rule Enforcement Tiers (🔴🟡🟢), + Tiered Development Flow                                                                                                                                                                                                                                                                                                                                                                                                                              | Human Dev + AI |
| 1.8.2   | 2026-03-21 | + Context Triggers, + Code Snippets, + Error Handling, + i18n                                                                                                                                                                                                                                                                                                                                                                                                                             | Human Dev + AI |
| 1.8.1   | 2026-03-21 | + ADR-019 UUID patterns, + Phase 5.4 pending files                                                                                                                                                                                                                                                                                                                                                                                                                                        | Claude Sonnet  |
| 1.8.0   | 2026-03-19 | + Security overrides, + UAT criteria reference                                                                                                                                                                                                                                                                                                                                                                                                                                            | Human Dev      |
| 1.7.2   | 2026-03-15 | + AI Boundary rules (ADR-018)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Gemini Pro     |

---

**To update this file:**

1. Edit relevant sections
2. Update Change Log above
3. Bump version number in header
4. Commit: `spec(agents): bump to vX.X.X - <brief description>`
