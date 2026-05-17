# 🚀 Spec-Kit: Antigravity Skills & Workflows

> **The Event Horizon of Software Quality.**
> _Adapted for Google Antigravity IDE from [github/spec-kit](https://github.com/github/spec-kit)._
>
> # Speckit Agent Infrastructure (v1.9.0)
>
> - Version: 1.9.0
> - Last Updated: 2026-05-13
> - Core Principle: **Sync with AGENTS.md v1.9.0**

---

## 🌟 Overview

Welcome to the **Antigravity Edition** of Spec-Kit. This system is architected to empower your AI pair programmer (Antigravity) to drive the entire Software Development Life Cycle (SDLC) using two powerful mechanisms: **Workflows** and **Skills**.

### 🔄 Dual-Mode Intelligence

In this edition, Spec-Kit commands have been split into two interactive layers:

1.  **Workflows (`/command`)**: High-level orchestrations that guide the agent through a series of logical steps. **The easiest way to run a skill is by typing its corresponding workflow command.**
2.  **Skills (`@speckit-name`)**: Packaged agentic capabilities. Mentions of a skill give the agent immediate context and autonomous "know-how" to execute the specific toolset associated with that phase.

> **To understand the power of Skills in Antigravity, read the docs here:**
> [https://antigravity.google/docs/skills](https://antigravity.google/docs/skills)

---

## 🛠️ Installation

To enable these agent capabilities in your project:

1.  **Add the folder**: Drop the `.agents/` folder into the root of your project workspace.
2.  **That's it!** Antigravity automatically detects the `.agents/skills` and `.agents/workflows` directories. It will instantly gain the ability to perform Spec-Driven Development.

> **💡 Compatibility Note:** This toolkit is compatible with multiple AI coding agents. To use with Claude Code, rename the `.agents` folder to `.claude`. The skills and workflows will function identically.

### Prerequisites (Optional)

Some skills and scripts reference a `.specify/` directory for templates and project memory. If you want the full Spec-Kit experience (template-driven spec/plan creation), create this structure at repo root:

```text
.specify/
├── templates/
│   ├── spec-template.md          # Template for /speckit-specify
│   ├── plan-template.md          # Template for /speckit-plan
│   ├── tasks-template.md         # Template for /speckit-tasks
│   └── agent-file-template.md    # Template for update-agent-context.sh
└── memory/
    └── constitution.md           # Project governance rules (/speckit-constitution)
```

> **Note:** If `.specify/` is absent, skills will still function — they'll create blank files instead of using templates. The constitution workflow (`/speckit-constitution`) will create this structure for you on first run.

---

## 🏗️ The Architecture

The toolkit is organized into modular components that provide both the logic (Scripts) and the structure (Templates) for the agent.

```text
.agents/                        # Agent Skills & Rules
├── skills/                        # @ Mentions (Agent Intelligence)
│   ├── nestjs-best-practices/     # NestJS Architecture Patterns
│   ├── next-best-practices/       # Next.js App Router Patterns
│   ├── speckit-analyze/           # Consistency Checker
│   ├── speckit-checker/           # Static Analysis Aggregator
│   ├── speckit-checklist/         # Requirements Validator
│   ├── speckit-clarify/           # Ambiguity Resolver
│   ├── speckit-constitution/      # Governance Manager
│   ├── speckit-diff/              # Artifact Comparator
│   ├── speckit-implement/         # Code Builder (Anti-Regression)
│   ├── speckit-migrate/           # Legacy Code Migrator
│   ├── speckit-plan/              # Technical Planner
│   ├── speckit-quizme/            # Logic Challenger (Red Team)
│   ├── speckit-reviewer/          # Code Reviewer
│   ├── speckit-security-audit/    # Security Auditor (OWASP/CASL/ClamAV)
│   ├── speckit-specify/           # Feature Definer
│   ├── speckit-status/            # Progress Dashboard
│   ├── speckit-tasks/             # Task Breaker
│   ├── speckit-taskstoissues/     # Issue Tracker Syncer (GitHub + Gitea)
│   ├── speckit-tester/            # Test Runner & Coverage
│   └── speckit-validate/          # Implementation Validator
│
├── workflows/                     # / Slash Commands (Orchestration)
│   ├── 00-speckit.all.md          # Full Pipeline (10 steps: Specify → Validate)
│   ├── 01–11-speckit-*.md         # Individual phase workflows
│   ├── speckit-prepare.md         # Prep Pipeline (5 steps: Specify → Analyze)
│   ├── schema-change.md           # DB Schema Change (ADR-009)
│   ├── create-backend-module.md   # NestJS Module Scaffolding
│   ├── create-frontend-page.md    # Next.js Page Scaffolding
│   ├── deploy.md                  # Deployment via Gitea CI/CD
│   ├── review.md                  # Code Review Workflow
│   └── util-speckit-*.md          # Utilities (checklist, diff, migrate, etc.)
│
├── rules/                         # Project Context & Validation Rules
│   ├── 00-project-context.md      # Role, Persona, Rule Tiers (v1.9.0)
│   ├── 01-adr-019-uuid.md         # UUID Strategy (Critical)
│   ├── 02-security.md             # Security Requirements
│   ├── 03-typescript.md            # TypeScript Standards
│   ├── 04-domain-terminology.md   # DMS Glossary Compliance
│   ├── 05-forbidden-actions.md    # Critical Prohibited Patterns
│   ├── 06-backend-patterns.md     # NestJS Architecture Rules
│   ├── 07-frontend-patterns.md    # Next.js App Router Rules
│   ├── 08-development-flow.md      # Development Workflow
│   ├── 09-commit-checklist.md      # Pre-commit Validation
│   ├── 10-error-handling.md       # ADR-007 Compliance
│   └── 11-ai-integration.md       # ADR-018/020 AI Boundaries
│
└── scripts/
    ├── bash/                      # Bash Core (Kinetic logic)
    ├── powershell/                # PowerShell Equivalents (Windows-native)
    ├── fix_links.py               # Spec link fixer
    ├── verify_links.py            # Spec link verifier
    └── start-mcp.js               # MCP server launcher
└── util-speckit-*.md              # Utilities (checklist, diff, migrate, etc.)
```

---

## 🗺️ Mapping: Commands to Capabilities

| Phase             | Workflow Trigger              | Antigravity Skill         | Role                                                    |
| :---------------- | :---------------------------- | :------------------------ | :------------------------------------------------------ |
| **Full Pipeline** | `/00-speckit-all`             | N/A                       | Runs full SDLC pipeline (10 steps: Specify → Validate). |
| **Governance**    | `/01-speckit-constitution`    | `@speckit-constitution`   | Establishes project rules & principles.                 |
| **Definition**    | `/02-speckit-specify`         | `@speckit-specify`        | Drafts structured `spec.md`.                            |
| **Ambiguity**     | `/03-speckit-clarify`         | `@speckit-clarify`        | Resolves gaps post-spec.                                |
| **Architecture**  | `/04-speckit-plan`            | `@speckit-plan`           | Generates technical `plan.md`.                          |
| **Decomposition** | `/05-speckit-tasks`           | `@speckit-tasks`          | Breaks plans into atomic tasks.                         |
| **Consistency**   | `/06-speckit-analyze`         | `@speckit-analyze`        | Cross-checks Spec vs Plan vs Tasks.                     |
| **Execution**     | `/07-speckit-implement`       | `@speckit-implement`      | Builds implementation with safety protocols.            |
| **Quality**       | `/08-speckit-checker`         | `@speckit-checker`        | Runs static analysis (Linting, Security, Types).        |
| **Testing**       | `/09-speckit-tester`          | `@speckit-tester`         | Runs test suite & reports coverage.                     |
| **Review**        | `/10-speckit-reviewer`        | `@speckit-reviewer`       | Performs code review (Logic, Perf, Style).              |
| **Validation**    | `/11-speckit-validate`        | `@speckit-validate`       | Verifies implementation matches Spec requirements.      |
| **Preparation**   | `/speckit-prepare`            | N/A                       | Runs Specify → Analyze prep sequence (5 steps).         |
| **Schema**        | `/schema-change`              | N/A                       | DB schema changes per ADR-009 (no migrations).          |
| **Security**      | N/A                           | `@speckit-security-audit` | OWASP Top 10 + CASL + ClamAV audit.                     |
| **Checklist**     | `/util-speckit-checklist`     | `@speckit-checklist`      | Generates feature checklists.                           |
| **Diff**          | `/util-speckit-diff`          | `@speckit-diff`           | Compares artifact versions.                             |
| **Migration**     | `/util-speckit-migrate`       | `@speckit-migrate`        | Port existing code to Spec-Kit.                         |
| **Red Team**      | `/util-speckit-quizme`        | `@speckit-quizme`         | Challenges logical flaws.                               |
| **Status**        | `/util-speckit-status`        | `@speckit-status`         | Shows feature completion status.                        |
| **Tracking**      | `/util-speckit-taskstoissues` | `@speckit-taskstoissues`  | Syncs tasks to GitHub/Gitea issues.                     |

---

## 🛡️ The Quality Assurance Pipeline

The following skills are designed to work together as a comprehensive defense against regression and poor quality. Run them in this order:

| Step            | Skill               | Core Question                     | Focus                                                                                                                                                 |
| :-------------- | :------------------ | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Checker**  | `@speckit-checker`  | _"Is the code compliant?"_        | **Syntax & Security**. Runs compilation, linting (ESLint/GolangCI), and vulnerability scans (npm audit/govulncheck). Catches low-level errors first.  |
| **2. Tester**   | `@speckit-tester`   | _"Does it work?"_                 | **Functionality**. Executes your test suite (Jest/Pytest/Go Test) to ensure logic performs as expected and tests pass.                                |
| **3. Reviewer** | `@speckit-reviewer` | _"Is the code written well?"_     | **Quality & Maintainability**. Analyzes code structure for complexity, performance bottlenecks, and best practices, acting as a senior peer reviewer. |
| **4. Validate** | `@speckit-validate` | _"Did we build the right thing?"_ | **Requirements**. Semantically compares the implementation against the defined `spec.md` and `plan.md` to ensure all feature requirements are met.    |

> **🤖 Power User Tip:** You can amplify this pipeline by creating a custom **MCP Server** or subagent that delegates heavy reasoning to a dedicated LLM.
>
> - **Use Case:** Bind the `@speckit-validate` and `@speckit-reviewer` steps to a large-context model.
> - **Benefit:** Large-context models (1M+ tokens) excel at analyzing the full project context against the Spec, finding subtle logical flaws that smaller models miss.
> - **How:** Create a wrapper script `scripts/gemini-reviewer.sh` that pipes the `tasks.md` and codebase to an LLM, then expose this as a tool.

---

## 🏗️ The Design & Management Pipeline

These workflows function as the "Control Plane" of the project, managing everything from idea inception to status tracking.

| Step               | Workflow                                            | Core Question         | Focus                                                                                                                                                        |
| :----------------- | :-------------------------------------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Preparation** | `/speckit-prepare`                                  | _"Are we ready?"_     | **The Macro-Workflow**. Runs Skills 02–06 (Specify $\to$ Clarify $\to$ Plan $\to$ Tasks $\to$ Analyze) in one sequence to go from "Idea" to "Ready to Code". |
| **2. Migration**   | `/util-speckit-migrate`                             | _"Can we import?"_    | **Onboarding**. Reverse-engineers existing code into `spec.md`, `plan.md`, and `tasks.md`.                                                                   |
| **3. Red Team**    | `/util-speckit-quizme`                              | _"What did we miss?"_ | **Hardening**. Socratic questioning to find logical gaps in your specification before you plan.                                                              |
| **4. Export**      | `/util-speckit-taskstoissues`                       | _"Who does what?"_    | **Handoff**. Converts your `tasks.md` into GitHub or Gitea issues with labels and milestones.                                                                |
| **5. Status**      | `/util-speckit-status`                              | _"Are we there yet?"_ | **Tracking**. Scans all artifacts to report feature completion percentage.                                                                                   |
| **6. Utilities**   | `/util-speckit-diff` <br> `/util-speckit-checklist` | _"What changed?"_     | **Support**. View artifact diffs or generate quick acceptance checklists.                                                                                    |

### 🔄 The Design Sequence

**Stage 1: Inception**

- _Legacy Project?_ $\to$ Run **`/util-speckit-migrate`**.
- _New Feature?_ $\to$ Run **`/speckit-prepare`**.

**Stage 2: Hardening**

- Run **`/util-speckit-quizme`** to catch edge cases.
- Run **`/speckit-prepare`** again to regenerate the Plan based on restricted specs.

**Stage 3: Handoff**

- Run **`/util-speckit-taskstoissues`** to sync with your board.

---

## 🚀 Getting Started in Antigravity

Once the `.agents` folder is present, you can talk to your agent as a partner. You can trigger a full process using a slash command or reference a specific capability using a skill mention.

**Example Conversation:**

> **Developer**: "**/02-speckit-specify** Add a real-time notification system using WebSockets."
>
> **Antigravity**: "Understood. Executing the **@speckit-specify** skill. Creating feature branch `005-notifications` and drafting the initial specification..."
> _(Antigravity creates branch, drafts spec.md)_
>
> **Antigravity**: "Specification ready. I've identified some ambiguity in the reconnection strategy. Should I use **@speckit-clarify** to resolve this?"
>
> **Developer**: "Yes, use **@speckit-clarify**."
> _(Antigravity executes the skill logic, interviewing the developer and updating the spec)_
>
> **Antigravity**: "The spec is now robust. I'm ready to trigger **/04-speckit-plan** and **/05-speckit-tasks** to prepare for implementation."

---

## 🏆 Best Practices for Antigravity

To get the most out of this system, follow these **Spec-Driven Development (SDD)** rules:

### 1. The Constitution is King 👑

**Never skip `/01-speckit-constitution`.**

- This file is the "Context Window Anchor" for the AI.
- It prevents hallucinations about tech stack (e.g., "Don't use jQuery" or "Always use TypeScript strict mode").
- **Tip:** If Antigravity makes a style mistake, don't just fix the code—update the Constitution so it never happens again.

### 2. The Layered Defense 🛡️

Don't rush to code. The workflow exists to catch errors _cheaply_ before they become expensive bugs.

- **Ambiguity Layer**: `/03-speckit-clarify` catches misunderstandings.
- **Logic Layer**: `/util-speckit-quizme` catches edge cases.
- **Consistency Layer**: `/06-speckit-analyze` catches gaps between Spec and Plan.

### 3. The 15-Minute Rule ⏱️

When generating `tasks.md` (Skill 05), ensure tasks are **atomic**.

- **Bad Task**: "Implement User Auth" (Too big, AI will get lost).
- **Good Task**: "Create `User` Mongoose schema with email validation" (Perfect).
- **Rule of Thumb**: If a task takes Antigravity more than 3 tool calls to finish, it's too big. Break it down.

### 4. "Refine, Don't Rewind" ⏩

If you change your mind mid-project:

1.  Don't just edit the code.
2.  Edit the `spec.md` to reflect the new requirement.
3.  Run `/util-speckit-diff` to see the drift.
4.  This keeps your documentation alive and truthful.

---

## 🧩 Adaptation Notes

- **Skill-Based Autonomy**: Mentions like `@speckit-plan` trigger the agent's internalized understanding of how to perform that role.
- **Shared Script Core**: Logic resides in `.agents/scripts/bash` (modular) with PowerShell equivalents in `scripts/powershell/` for Windows-native execution.
- **Agent-Native**: Designed to be invoked via Antigravity tool calls and reasoning rather than just terminal strings.
- **LCBP3-DMS Specific**: Includes project-specific skills (`nestjs-best-practices`, `next-best-practices`, `speckit-security-audit`) and workflows (`/schema-change`, `/create-backend-module`, `/deploy`).

---

## 🏗️ LCBP3-DMS Project Notes (v1.9.0)

### 📊 Current Status: Production Ready (2026-04-14)

| Area          | Status                          |
| ------------- | ------------------------------- |
| Backend       | ✅ 18 Modules, Production Ready |
| Frontend      | ✅ 100% Complete                |
| Database      | ✅ Schema v1.8.6 Stable         |
| Documentation | ✅ **10/10 Gaps Closed**        |
| AI Migration  | ✅ Ollama Integration Complete  |
| UAT           | ✅ Completed Successfully       |
| Deployment    | ✅ Production Deployed          |

### 📁 Key Spec Files (Always Check Before Writing Code)

| เอกสาร          | Path                                                             | ใช้เมื่อ            |
| --------------- | ---------------------------------------------------------------- | ------------------- |
| Schema Tables   | `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`    | ก่อนเขียน Query     |
| Data Dictionary | `specs/03-Data-and-Storage/03-01-data-dictionary.md`             | ตรวจ Business Rules |
| Edge Cases      | `specs/01-Requirements/01-06-edge-cases-and-rules.md`            | 37 Rules            |
| Migration Scope | `specs/03-Data-and-Storage/03-06-migration-business-scope.md`    | Migration Bot       |
| Release Policy  | `specs/04-Infrastructure-OPS/04-08-release-management-policy.md` | ก่อน Deploy         |
| UAT Criteria    | `specs/01-Requirements/01-05-acceptance-criteria.md`             | ตรวจ Feature        |

### ⚡ Project-Specific Workflow Cheatsheet

| Task                  | Workflow / Command        | Notes                             |
| --------------------- | ------------------------- | --------------------------------- |
| Create Backend Module | `/create-backend-module`  | Scaffolds NestJS module           |
| Create Frontend Page  | `/create-frontend-page`   | Next.js App Router page           |
| Schema Change         | `/schema-change`          | ADR-009: No migrations            |
| Deploy                | `/deploy`                 | Blue-Green via Gitea CI/CD        |
| UAT Feature Check     | `/11-speckit-validate`    | vs `01-05-acceptance-criteria.md` |
| Security Audit        | `@speckit-security-audit` | OWASP + CASL + ClamAV             |

### 🚫 Critical Forbidden Actions

- ❌ DO NOT bypass Release Gates before deploying — `04-08-release-management-policy.md`
- ❌ DO NOT start Migration without Gate #1 approval — `03-06-migration-business-scope.md`
- ❌ DO NOT use TypeORM Migrations — modify schema SQL directly (ADR-009)
- ❌ DO NOT give Ollama direct DB access — all writes via DMS API (ADR-018)
- ❌ DO NOT use `any` TypeScript type anywhere

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### **Version Inconsistency Errors**

**Problem**: Scripts report version mismatches between files.

**Solution**:

```bash
# Run version validation
./scripts/bash/validate-versions.sh

# Fix by updating all files to v1.9.0
# Then re-run validation to confirm
```

**Files to check**:

- `.agents/README.md`
- `.agents/skills/VERSION`
- `.agents/rules/00-project-context.md`
- `.agents/skills/skills.md`

#### **Missing Workflow Files**

**Problem**: Workflows not found in `.windsurf/workflows/`.

**Solution**:

```bash
# Sync workflow check
./scripts/bash/sync-workflows.sh

# Verify all 23 expected workflows are present
# Create missing ones from templates if needed
```

#### **Skill Health Issues**

**Problem**: Skills missing SKILL.md or required sections.

**Solution**:

```bash
# Run comprehensive skill audit
./scripts/bash/audit-skills.sh

# Check specific skill issues
# Missing files will be listed with specific errors
```

**Required SKILL.md sections**:

- Front matter: `name`, `description`, `version`
- Content: `## Role`, `## Task`

#### **Script Permission Issues**

**Problem**: Bash scripts not executable.

**Solution**:

```bash
# Make scripts executable
chmod +x .agents/scripts/bash/*.sh

# Verify with
ls -la .agents/scripts/bash/
```

#### **PowerShell Execution Policy**

**Problem**: PowerShell scripts blocked by execution policy.

**Solution**:

```powershell
# Check current policy
Get-ExecutionPolicy

# Allow scripts for current user
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run bypass for single script
PowerShell -ExecutionPolicy Bypass -File .agents/scripts/powershell/audit-skills.ps1
```

### Debug Mode

**Enable verbose output**:

```bash
# Run scripts with debug info
bash -x .agents/scripts/bash/audit-skills.sh

# PowerShell with verbose output
$VerbosePreference = "Continue"
. .agents/scripts/powershell/audit-skills.ps1
```

### Health Check Commands

**Quick health assessment**:

```bash
# 1. Check versions
./scripts/bash/validate-versions.sh

# 2. Audit skills
./scripts/bash/audit-skills.sh

# 3. Sync workflows
./scripts/bash/sync-workflows.sh

# 4. Check directory structure
find .agents -type f -name "*.md" | wc -l
find .windsurf/workflows -name "*.md" | wc -l
```

**PowerShell equivalent**:

```powershell
# 1. Check versions
. .agents/scripts/powershell/validate-versions.ps1

# 2. Audit skills
. .agents/scripts/powershell/audit-skills.ps1

# 3. Count files
(Get-ChildItem -Path .agents -Recurse -Filter "*.md").Count
(Get-ChildItem -Path .windsurf/workflows -Filter "*.md").Count
```

### Getting Help

**If issues persist**:

1. Check LCBP3 project version alignment
2. Verify `.specify/` directory structure (if using templates)
3. Ensure all dependencies are installed (bash, powershell core)
4. Review the specific error messages in script output
5. Check this README for workflow path updates (`.windsurf/workflows`)

---

_Built with logic from [Spec-Kit](https://github.com/github/spec-kit). Powered by Antigravity._
