# LCBP3 Agent Rules

Critical rules and guidelines for AI agents working on LCBP3-DMS.

## Version

- **Current:** v1.9.14
- **Last Updated:** 2026-08-24
- **Synced with:** `AGENTS.md` (v1.9.12) + MCP servers (8)

## Purpose

This directory contains rule files that define:

- Project context and role expectations
- Critical Tier 1 rules (CI blockers)
- Coding standards and patterns
- Domain terminology and glossary
- Development workflows
- Security requirements
- AI integration architecture (ADR-023/023A)

## Rule Enforcement Tiers

### 🔴 Tier 1 — CRITICAL (CI BLOCKER)

Build fails immediately if violated:

- Security (Auth, RBAC, Validation)
- UUID Strategy (ADR-019) — no `parseInt` / `Number` / `+` on UUID
- Database correctness — verify schema before writing queries
- File upload security (ClamAV + whitelist)
- AI validation boundary (ADR-023)
- Error handling strategy (ADR-007)
- Forbidden patterns: `any`, `console.log`, UUID misuse, `id ?? ''` fallback
- Dependency overrides bounded (D144 — ห้าม `>=` ลอย ๆ / `*` / `latest`)

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

Must fix before merge:

- Architecture patterns (thin controller, business logic in service)
- Test coverage (80%+ business logic, 70%+ backend overall)
- Cache invalidation
- Naming conventions
- TypeScript Standards: Missing JSDoc, explicit types, or file headers

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

## Rule Files

### Core Rules (Tier 1 - CRITICAL)

| File                    | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `00-project-context.md` | Project context, role & persona, tier classification, specs folder organization |
| `01-adr-019-uuid.md`    | UUID handling strategy — no parseInt, use publicId only                         |
| `02-security.md`        | Security requirements, checklist, ADR-023/023A AI boundaries                    |

### Coding Standards

| File                      | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `03-typescript.md`        | TypeScript rules, file headers, i18n guidelines         |
| `06-backend-patterns.md`  | NestJS patterns, UUID resolution, API response patterns |
| `07-frontend-patterns.md` | Next.js patterns, RHF+Zod+TanStack Query, UUID handling |

### Domain & Workflow

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `04-domain-terminology.md` | DMS glossary, key spec files priority table                   |
| `08-development-flow.md`   | Development workflow by work type (Critical/Normal/Quick Fix) |

### Compliance & Architecture

| File                      | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `05-forbidden-actions.md` | Actions that must never be done, schema changes, UUID handling |
| `09-commit-checklist.md`  | Pre-commit verification, commit message format                 |
| `10-error-handling.md`    | ADR-007 error handling strategy, layered classification        |
| `11-ai-integration.md`    | ADR-023/023A AI architecture, 2-model stack, BullMQ 2-queue    |

### Reference Tables (extracted from AGENTS.md v1.9.12)

| File                              | Purpose                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `12-key-spec-files.md`            | Full Key Spec Files table with ADR status and paths                   |
| `13-specs-folder-organization.md` | Specs folder structure, naming conventions, categories                |
| `14-context-aware-triggers.md`    | Request → spec files mapping with status legend                       |
| `15-mcp-mariadb-tools.md`         | MCP MariaDB tools, usage patterns, safety warnings                    |
| `16-mcp-memory-tools.md`          | MCP Memory Knowledge Graph tools, usage patterns, cautions            |
| `17-mcp-redis-tools.md`           | MCP Redis tools — cache debug, Redlock, BullMQ inspection             |
| `18-mcp-qdrant-tools.md`          | MCP Qdrant tools — vector DB inspection, multi-tenancy                |
| `19-mcp-gitea-tools.md`           | MCP Gitea tools — issues, PRs, labels, Actions CI/CD, wiki            |
| `20-mcp-fetch-tools.md`           | MCP Fetch tools — web content retrieval (HTML/MD/JSON)                |
| `21-mcp-stitch-tools.md`          | MCP StitchMCP tools — UI mockup + design system generation            |
| `22-mcp-playwright-tools.md`      | MCP Playwright tools — browser automation, E2E, real-app verify       |
| `23-dependency-overrides.md`      | D144–D146 bounded override rule, undici pin, service-down debug order |

## Maintenance

When updating rules:

1. **Check AGENTS.md version** — Ensure rule files are synced
2. **Update version numbers** — Bump version in `00-project-context.md` only (03-typescript.md no longer has version)
3. **Review ADR references** — Ensure all ADR references are current (ADR-023, ADR-023A, ADR-024~028)
4. **Add new forbidden actions** — When new patterns are identified as violations
5. **Update key spec files table** — When new ADRs or guidelines are added
6. **Update Tier 3 SPECIALIZED WORK** — When new domain-specific workflows are added

## Related Documents

- `AGENTS.md` — Master agent configuration and context
- `specs/06-Decision-Records/` — All Architecture Decision Records
- `specs/05-Engineering-Guidelines/` — Backend, frontend, and testing guidelines
