# `.agents/skills/` — LCBP3 Agent Skill Pack

**Version:** 1.9.0 | **Last Updated:** 2026-06-07 | **Total Skills:** 24

Agent skills for AI-assisted development in **Devin IDE** (and compatible agents: Codex CLI, opencode, Amp, Antigravity, AGENTS.md-aware tools).

---

## 📂 Layout

```
.agents/skills/
├── VERSION                      # Single source of truth for skill-pack version
├── skills.md                    # Overview + dependency matrix + health monitoring
├── _LCBP3-CONTEXT.md            # Shared LCBP3 context injected into every speckit-* skill
├── README.md                    # (this file)
├── save-memory/                 # Session log & project memory update
├── nestjs-best-practices/       # Backend rules (40 rules across 10 categories)
├── next-best-practices/         # Frontend rules (Next.js 15+)
├── e2e-testing/                 # Playwright E2E testing patterns (POM, flaky tests, CI/CD)
├── verification-loop/           # Comprehensive verification (build, typecheck, lint, test, security)
├── security-review/             # OWASP Top 10 + ADR compliance checklist
└── speckit-*/                   # 18 workflow skills (spec → plan → tasks → implement → …)
```

Each skill directory contains:

- `SKILL.md` — frontmatter (`name`, `description`, `version: 1.9.0`, `scope`, `depends-on`, `handoffs`) + instructions
- `templates/` _(optional)_ — artifact templates (spec/plan/tasks/checklist)
- `rules/` _(nestjs only)_ — individual rule files grouped by prefix (`arch-`, `security-`, `db-`, etc.)

---

## 🚀 How Devin Invokes These Skills

1. **Skill tool** — Devin discovers skills by scanning `.agents/skills/*/SKILL.md` frontmatter. Skills marked `user-invocable: false` are used silently by Cascade.
2. **Slash commands** — `.devin/workflows/*.md` wraps each skill as a slash command (e.g. `/04-speckit.plan`). The workflow file is short; the heavy lifting is delegated to the skill via `skill` tool.

Both paths end up executing the same `SKILL.md` instructions.

---

## 🧭 Typical Flow

```
/01-speckit.constitution   → AGENTS.md / product vision
/02-speckit.specify        → specs/feat-XXX/spec.md
/03-speckit.clarify        → updates spec.md (up to 5 targeted questions)
/04-speckit.plan           → specs/feat-XXX/plan.md + data-model.md + contracts/
/05-speckit.tasks          → specs/feat-XXX/tasks.md
/06-speckit.analyze        → cross-artifact consistency report (read-only)
/07-speckit.implement      → executes tasks with Ironclad Protocols (Blast Radius + Strangler + TDD)
/08-speckit.checker        → pnpm lint / typecheck / markdown-lint
/09-speckit.tester         → pnpm test + coverage gates (Backend 70%+, Business Logic 80%+)
/10-speckit.reviewer       → code review with Tier 1/2/3 classification
/11-speckit.validate       → UAT / acceptance-criteria.md
```

Use `/00-speckit.all` to run specify → clarify → plan → tasks → analyze in one go.

---

## 🛠️ Helper Scripts

From repo root:

| Script                                                 | Purpose                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `./.agents/scripts/bash/check-prerequisites.sh --json` | Emit `FEATURE_DIR` + `AVAILABLE_DOCS` for a feature branch |
| `./.agents/scripts/bash/setup-plan.sh --json`          | Emit `FEATURE_SPEC`, `IMPL_PLAN`, `SPECS_DIR`, `BRANCH`    |
| `./.agents/scripts/bash/update-agent-context.sh devin` | Append tech entries to `AGENTS.md`                         |
| `./.agents/scripts/bash/audit-skills.sh`               | Validate all `SKILL.md` frontmatter + presence             |
| `./.agents/scripts/bash/validate-versions.sh`          | Version consistency check                                  |
| `./.agents/scripts/bash/sync-workflows.sh`             | Verify every skill has a `.devin/workflows/*.md` wrapper   |

All scripts mirror to `.agents/scripts/powershell/*.ps1` for Windows.

---

## ⚠️ Tier 1 Non-Negotiables (auto-enforced)

- ADR-019 — `publicId` exposed directly; no `parseInt` / `Number` / `+` on UUID; no `id ?? ''` fallback
- ADR-009 — edit SQL schema directly, no TypeORM migrations
- ADR-016 — JWT + CASL on every mutation; `Idempotency-Key` required; ClamAV two-phase upload
- ADR-018 — AI via DMS API only (Ollama on Admin Desktop; no direct DB/storage)
- ADR-007 — layered error classification (Validation / Business / System)
- Zero `any`, zero `console.log` (use `Logger`)

See [`_LCBP3-CONTEXT.md`](./_LCBP3-CONTEXT.md) for the complete list.

---

## 🤝 Extending

To add a new skill:

1. Create `NAME/SKILL.md` with frontmatter: `name`, `description`, `version: 1.9.0`, `scope`, `depends-on`.
2. Append an LCBP3 context reference pointing to `_LCBP3-CONTEXT.md`.
3. Wrap with `.devin/workflows/NAME.md` so it becomes a slash command.
4. Update [`skills.md`](./skills.md) dependency matrix.
5. Run `./.agents/scripts/bash/audit-skills.sh` → must pass.

---

## 📚 References

- **Canonical rules:** `AGENTS.md` (repo root)
- **Product vision:** `specs/00-Overview/00-03-product-vision.md`
- **ADRs:** `specs/06-Decision-Records/`
- **Engineering guidelines:** `specs/05-Engineering-Guidelines/`
- **Contributing:** `CONTRIBUTING.md`
