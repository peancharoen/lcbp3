# LCBP3 Agent Rules

Critical rules and guidelines for AI agents working on LCBP3-DMS.

## Version

- **Current:** v1.9.3
- **Last Updated:** 2026-05-15
- **Synced with:** `AGENTS.md` (v1.9.3)

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

### 🟡 Tier 2 — IMPORTANT (CODE REVIEW)

Must fix before merge:
- Architecture patterns (thin controller, business logic in service)
- Test coverage (80%+ business logic, 70%+ backend overall)
- Cache invalidation
- Naming conventions
- TypeScript Standards: Missing JSDoc, explicit types, or file headers

### 🟢 Tier 3 — GUIDELINES

Best practice — follow when possible:
- Code style / formatting (Prettier handles)
- Comment completeness
- Minor optimizations

## Rule Files

### Core Rules (Tier 1 - CRITICAL)

| File | Purpose |
|------|---------|
| `00-project-context.md` | Project context, role & persona, tier classification, specs folder organization |
| `01-adr-019-uuid.md` | UUID handling strategy — no parseInt, use publicId only |
| `02-security.md` | Security requirements, checklist, ADR-023/023A AI boundaries |

### Coding Standards

| File | Purpose |
|------|---------|
| `03-typescript.md` | TypeScript rules, file headers, i18n guidelines |
| `06-backend-patterns.md` | NestJS patterns, UUID resolution, API response patterns |
| `07-frontend-patterns.md` | Next.js patterns, RHF+Zod+TanStack Query, UUID handling |

### Domain & Workflow

| File | Purpose |
|------|---------|
| `04-domain-terminology.md` | DMS glossary, key spec files priority table |
| `08-development-flow.md` | Development workflow by work type (Critical/Normal/Quick Fix) |

### Compliance & Architecture

| File | Purpose |
|------|---------|
| `05-forbidden-actions.md` | Actions that must never be done, schema changes, UUID handling |
| `09-commit-checklist.md` | Pre-commit verification, commit message format |
| `10-error-handling.md` | ADR-007 error handling strategy, layered classification |
| `11-ai-integration.md` | ADR-023/023A AI architecture, 2-model stack, BullMQ 2-queue |

## Key Spec Files Priority

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others

| Document | Path | Use When |
|----------|------|----------|
| **Glossary** | `specs/00-overview/00-02-glossary.md` | Verify domain terminology |
| **Schema Tables** | `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | Before writing any query |
| **Data Dictionary** | `specs/03-Data-and-Storage/03-01-data-dictionary.md` | Field meanings + business rules |
| **Edge Cases** | `specs/01-Requirements/01-06-edge-cases-and-rules.md` | Prevent bugs in flows |
| **ADR-019 UUID** | `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md` | UUID-related work |
| **ADR-023 AI** | `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md` | AI integration work |
| **Backend Guidelines** | `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md` | NestJS patterns |
| **Frontend Guidelines** | `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md` | Next.js patterns |
| **Testing Strategy** | `specs/05-Engineering-Guidelines/05-04-testing-strategy.md` | Coverage goals |

## Maintenance

When updating rules:

1. **Check AGENTS.md version** — Ensure rule files are synced
2. **Update version numbers** — Bump version in `00-project-context.md` and `03-typescript.md`
3. **Review ADR references** — Ensure all ADR references are current (ADR-023, ADR-023A, etc.)
4. **Add new forbidden actions** — When new patterns are identified as violations
5. **Update key spec files table** — When new ADRs or guidelines are added

## Related Documents

- `AGENTS.md` — Master agent configuration and context
- `specs/06-Decision-Records/` — All Architecture Decision Records
- `specs/05-Engineering-Guidelines/` — Backend, frontend, and testing guidelines
