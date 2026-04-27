# 🧭 LCBP3-DMS Context Appendix (Shared)

> This file is included/referenced by every Speckit skill as the authoritative project context.
> Skills **must** load it (or the files it links to) before generating any artifact.

**Project:** NAP-DMS (LCBP3) — Laem Chabang Port Phase 3 Document Management System
**Stack:** NestJS 11 + Next.js 16 + TypeScript + MariaDB 11.8 + Redis + BullMQ + Elasticsearch + Ollama (on-prem AI)
**Version:** 1.8.9 (2026-04-18)

---

## 📌 Canonical Rule Sources (read in this order)

1. **`AGENTS.md`** (repo root) — primary rule file for AI agents; supersedes legacy `GEMINI.md`.
2. **`specs/06-Decision-Records/`** — architectural decisions (22 ADRs); ADR priority > Engineering Guidelines.
3. **`specs/05-Engineering-Guidelines/`** — backend/frontend/testing/i18n/git patterns.
4. **`specs/00-Overview/00-02-glossary.md`** — domain terminology (Correspondence / RFA / Transmittal / Circulation).
5. **`specs/00-Overview/00-03-product-vision.md`** — project constitution (Vision, Strategic Pillars, Guardrails).
6. **`CONTRIBUTING.md`** — spec writing standards, PR template, review levels.
7. **`README.md`** — technology stack + getting started.

---

## 🔴 Tier 1 Non-Negotiables

- **ADR-019 UUID:** `publicId: string` exposed directly — **no** `@Expose({ name: 'id' })` rename; **no** `parseInt`/`Number`/`+` on UUID; **no** `id ?? ''` fallback in frontend.
- **ADR-009:** No TypeORM migrations — edit `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql` or add a `deltas/*.sql` file.
- **ADR-016 Security:** JWT + CASL 4-Level RBAC; `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` on every mutation controller; `ThrottlerGuard` on auth; bcrypt 12 rounds; `Idempotency-Key` required on POST/PUT/PATCH.
- **ADR-002 Document Numbering:** Redis Redlock + TypeORM `@VersionColumn` (double-lock). Never use application-side counter alone.
- **ADR-008 Notifications:** BullMQ queue — never inline email/notification in a request thread.
- **ADR-018 AI Boundary:** Ollama on Admin Desktop only; AI → DMS API → DB (never direct DB/storage). Human-in-the-loop validation required.
- **ADR-007 Error Handling:** Layered (Validation / Business / System); `BusinessException` hierarchy; user-friendly `userMessage` + `recoveryAction`; technical stack only in logs.
- **TypeScript Strict:** Zero `any`, zero `console.log` (use NestJS `Logger`).
- **i18n:** No hardcoded Thai/English strings in components — use i18n keys (see `05-08-i18n-guidelines.md`).
- **File Upload:** Two-phase (Temp → ClamAV → Permanent), whitelist `PDF/DWG/DOCX/XLSX/ZIP`, max 50MB, `StorageService` only.

---

## 🏷️ Domain Glossary (reject generic terms)

| ✅ Use | ❌ Don't Use |
| --- | --- |
| Correspondence | Letter, Communication, Document |
| RFA | Approval Request, Submit for Approval |
| Transmittal | Delivery Note, Cover Letter |
| Circulation | Distribution, Routing |
| Shop Drawing | Construction Drawing |
| Contract Drawing | Design Drawing, Blueprint |
| Workflow Engine | Approval Flow, Process Engine |
| Document Numbering | Document ID, Auto Number |

---

## 📁 Key Files for Generating / Validating Artifacts

| When you need... | Read |
| --- | --- |
| A new feature spec | `.agents/skills/speckit-specify/templates/spec-template.md` + `specs/01-Requirements/01-06-edge-cases-and-rules.md` |
| A plan | `.agents/skills/speckit-plan/templates/plan-template.md` + relevant ADRs |
| Task breakdown | `.agents/skills/speckit-tasks/templates/tasks-template.md` + existing patterns in `specs/08-Tasks/` |
| Acceptance criteria / UAT | `specs/01-Requirements/01-05-acceptance-criteria.md` |
| Schema / table definition | `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql` + `03-01-data-dictionary.md` |
| RBAC / permissions | `specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql` + `01-02-01-rbac-matrix.md` |
| Release / hotfix | `specs/04-Infrastructure-OPS/04-08-release-management-policy.md` |

---

## 🛠️ Helper Scripts (real paths in this repo)

- `./.agents/scripts/bash/check-prerequisites.sh` / `powershell/*.ps1`
- `./.agents/scripts/bash/setup-plan.sh`
- `./.agents/scripts/bash/update-agent-context.sh windsurf`
- `./.agents/scripts/bash/audit-skills.sh`
- `./.agents/scripts/bash/validate-versions.sh`
- `./.agents/scripts/bash/sync-workflows.sh`

---

## ✅ Commit Checklist (applied automatically by speckit-implement)

- [ ] UUID pattern verified (no `parseInt` / `Number` / `+` on UUID, no `id ?? ''` fallback)
- [ ] No `any`, no `console.log` in committed code
- [ ] Business comments in Thai, code identifiers in English
- [ ] Schema changes via SQL directly (not migration)
- [ ] Test coverage meets targets (Backend 70%+, Business Logic 80%+)
- [ ] Relevant ADRs referenced (007/008/009/016/018/019/020/021)
- [ ] Domain glossary terms used correctly
- [ ] Error handling: `Logger` + `HttpException` / `BusinessException`
- [ ] i18n keys used (no hardcode text)
- [ ] Cache invalidation when data mutated
- [ ] OWASP Top 10 review passed
