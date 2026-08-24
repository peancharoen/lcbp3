---
name: 104-speckit-plan
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
version: 1.9.0
depends-on:
  - 102-speckit-specify
handoffs:
  - label: Create Tasks
    agent: 105-speckit-tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: 205-speckit-checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Role

You are the **Antigravity System Architect**. Your role is to bridge the gap between functional specifications and technical implementation. You design data models, define API contracts, and perform technical research to ensure a robust and scalable architecture.

## Task

### Outline

1. **Setup**: Run `../scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `AGENTS.md`. Load IMPL_PLAN template from `templates/plan-template.md`.

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Phase 1: Decide whether a cross-session assurance ledger is required (see Ledger Decision below)
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, generated artifacts, and ledger path (if created).

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
   - Run `../scripts/bash/update-agent-context.sh devin`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/\*, quickstart.md, agent-specific file

### Ledger Decision (cross-session or high-risk work)

Before completing planning, decide whether this unit needs an assurance ledger per `_LCBP3-CONTRACTS.md`. Create a ledger if **any** of the following is true:

- Tier 3 specialized work (ADR-021, ADR-023/ADR-042 AI runtime, ADR-028 migration, multi-step workflow engine)
- Expected to span multiple chat sessions, worktrees, or branches
- Multiple agents/skills will touch the same scope
- Work affects protected boundaries (auth, migration, data integrity, public API, AI boundary, real money)
- User explicitly asks to continue later or resume pending work

If a ledger is needed:

1. Choose the appropriate template from `templates/`:
   - Generic cross-session: `templates/ledger-template.md`
   - ADR-028 migration: `templates/migration-ledger-template.md`
   - ADR-023/ADR-042 AI pipeline: `templates/ai-pipeline-ledger-template.md`
2. Derive a stable `ASSURANCE_UNIT_ID` from `repository/track/feature-or-phase` (e.g., `lcbp3/migration/legacy-doc-phase-2`, `lcbp3/ai/rag-sandbox-phase-1`).
3. Place the ledger in the repo at the location specified in the template (for example, `specs/200-fullstacks/feat-XXX/ledger.md`, `specs/06-Decision-Records/ADR-028-ledger-<source>-<target>.md`, or `specs/88-logs/session-ledger-<unit-id>.md`).
4. Fill base state: branch, ref, dirty files, objective, acceptance criteria, final boundary, protected boundaries.
5. Record the ledger path in the plan summary.

If a ledger is **not** needed, document the reason in the planning output (e.g., "Single-session, low-risk UI change — no ledger required") and continue with standard assurance.

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications

---

## LCBP3-DMS Context (MUST LOAD)

Before executing, load these references in order:

1. **[../\_LCBP3-CONTEXT.md](../_LCBP3-CONTEXT.md)** for canonical rules, Tier 1 non-negotiables, domain glossary, helper scripts, and commit checklist.
2. **[../\_LCBP3-CONTRACTS.md](../_LCBP3-CONTRACTS.md)** for the worker task packet, reviewer evidence bar, TDD evidence format, and cross-session assurance ledger.

Key constraints:

- Canonical rule sources (AGENTS.md, specs/06-Decision-Records/, specs/05-Engineering-Guidelines/)
- Tier 1 non-negotiables (ADR-019 UUID, ADR-044 schema (amends ADR-009), ADR-016 security, ADR-002 numbering, ADR-008 BullMQ, ADR-023/043 AI boundary (supersedes ADR-018/020), ADR-007 errors)
- Domain glossary (Correspondence / RFA / Transmittal / Circulation)
- Helper script real paths
- Commit checklist
