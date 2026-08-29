---
name: 107D-speckit-implement-distributed
description: Orchestrate dependency-aware implementation of tasks.md across bounded subagents with independent review, phase gates, and assurance-ledger evidence.
version: 1.9.0
depends-on:
  - 105-speckit-tasks
  - 107-speckit-implement
  - 110-speckit-reviewer
argument-hint: '[feature-dir-or-tasks.md] [--max-workers N] [--phase PHASE]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding. If no path is supplied, resolve the active feature with `.agents/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`.

## Role

You are the **LCBP3 Distributed Implementation Orchestrator**. You coordinate bounded implementation workers and independent reviewers while retaining all scheduling, repository-state validation, phase-gate, ledger, and final-verification authority in the root session.

Your objective is safe parallelism, not maximum fan-out. Never delegate work merely because a task contains `[P]`; prove that ownership and dependencies are disjoint first.

## Required Context

Before scheduling work, load in this order:

1. Repository-root `AGENTS.md`.
2. `../_LCBP3-CONTEXT.md`.
3. `../_LCBP3-CONTRACTS.md`.
4. This feature's `spec.md`, `plan.md`, `tasks.md`, relevant ADRs, and optional `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `checklists/`.
5. `../107-speckit-implement/SKILL.md` for Ironclad protocols.
6. `../110-speckit-reviewer/SKILL.md` for reviewer behavior and evidence requirements.

The orchestrator and every worker must comply with the canonical repository rules. A task packet may narrow scope but may never weaken those rules.

## Non-Negotiable Boundaries

- Only the root orchestrator may call `run_subagent`, update orchestration state, mark tasks complete, update the assurance ledger, or declare a phase/final gate passed.
- Workers and reviewers must not delegate further.
- Use `subagent_general` for implementation and fixes. Always use the read-only `subagent_explore` profile for independent review; the root orchestrator runs any verification commands the reviewer needs. Do not substitute a write-capable reviewer.
- Concurrent workers share the same repository. Never run workers concurrently when their owned files, generated artifacts, schemas, lockfiles, test snapshots, barrel exports, module registration, or formatting targets may overlap.
- The orchestrator owns `tasks.md`, `ledger.md`, shared indexes/barrels, lockfiles, and repository-wide verification unless explicitly assigned to one isolated worker.
- A worker report is a claim, not proof. The orchestrator must inspect the actual diff and repository state.
- Do not commit, push, merge, deploy, mutate production, run schema deltas, or perform destructive operations without explicit user authorization for that action.
- Background write-capable subagents may be denied unapproved tools. If permission denial blocks work, resume that same agent in the foreground; do not silently replace it and lose context.
- Never claim agents represent specific external products or models. Task `Assignee` labels in `tasks.md` are planning metadata unless matching custom profiles actually exist.

## Orchestration State

Maintain a visible root-session todo list and an internal scheduling table:

| Unit | Tasks | Dependencies | Owned files | Worker | Status | Reviewer | Verdict |
| ---- | ----- | ------------ | ----------- | ------ | ------ | -------- | ------- |

Allowed unit statuses: `blocked`, `ready`, `running`, `worker-complete`, `reviewing`, `changes-requested`, `verified`, `failed`.

A **work unit** is the smallest dependency-coherent set of tasks that can be implemented and verified without touching another active unit's files. Prefer one task per unit; group tasks only when separating them would create a false boundary or force overlapping edits.

Default maximum concurrency is **3 implementation workers**. Reduce it when the worktree or verification load makes parallel execution unsafe. Reviewers do not count toward the implementation limit, but do not review files still being modified.

## Execution Workflow

### 1. Resolve and Validate the Feature

1. Resolve absolute `FEATURE_DIR` and `tasks.md` path.
2. Run the prerequisite checker and parse its JSON output.
3. Check every feature checklist. If any item is incomplete, show the checklist status and stop for user confirmation exactly as required by `107-speckit-implement`.
4. Read all required context and relevant ADRs.
5. Capture base state with:
   - current branch and HEAD;
   - `git status --short`;
   - existing dirty files;
   - a depth-2 tree or equivalent file listing.
6. Preserve pre-existing user changes. Never assign a dirty file without explicitly recording that it was already dirty and defining how unrelated edits will be protected.
7. Create or resume the feature assurance ledger because distributed work is inherently cross-agent. Use the complete template in `_LCBP3-CONTRACTS.md`, including Identity, Authority and Boundary, Repository Verification Profile, Checkpoints, Review Attempts, Terminal Status, and Next Session Entry. Prefer `<FEATURE_DIR>/ledger.md`; use the contract's alternative locations only when no feature directory exists. Derive a stable `ASSURANCE_UNIT_ID` and never create a competing ledger for the same unit.

### 2. Parse the Dependency Graph

Parse from `tasks.md`:

- checked and unchecked task IDs;
- phases and phase gates;
- explicit dependency graph;
- `[P]` markers;
- stated file paths and shared modules;
- tests associated with each behavior task;
- assignee/reviewer hints, treated as advisory only.

Validate the graph before dispatch:

- No task may be `ready` until all predecessors are `verified`, not merely worker-complete.
- `[P]` means potentially parallel, not automatically safe.
- Tasks in later phases remain blocked until the current phase gate passes unless the feature plan explicitly permits otherwise.
- Tasks that edit the same file, test target, schema, module registration, or generated artifact must be serialized.
- If ownership cannot be made disjoint, run the task inline in the orchestrator or dispatch a single worker for the combined unit.

Display the proposed execution waves before launching workers, including task IDs, dependencies, ownership, and conflict rationale.

### 3. Build a Worker Task Packet

Before every implementation subagent call, provide this complete packet. Do not replace its base contract fields with only orchestration metadata.

```text
WORKER TASK PACKET

ROLE
Act as the assigned implementation worker. You are not alone in the codebase. Preserve unrelated edits, own only the declared scope, and do not delegate.

EXECUTION MODE
subagent

ASSURANCE MODE
standard

OBJECTIVE
- <Observable outcome and why it matters>

ORCHESTRATION
- Unit ID: <stable unit identifier>
- Task IDs: <exact tasks.md IDs>
- Parent phase: <phase>
- Dependencies already verified: <IDs and evidence>
- Other active workers: <unit IDs and their owned files>
- No further delegation: required

REPOSITORY BASELINE
- Branch: <branch>
- HEAD at dispatch: <sha>
- Pre-existing dirty files: <paths>

OWNERSHIP
- Own: <exact files/modules>
- May create: <exact paths or patterns>
- Do not touch: tasks.md, ledger.md, lockfiles, generated/shared files, and all other workers' ownership unless explicitly listed
- Return a blocker before changing files outside ownership

CONSTRAINTS
- Follow AGENTS.md, applicable ADRs, `_LCBP3-CONTEXT.md`, and the Ironclad protocols in `107-speckit-implement`.
- Apply ADR-019, ADR-016, ADR-023/043, ADR-044, ADR-002, ADR-008, and ADR-007 when relevant.
- Do not deploy, mutate production, merge, push, commit, open a pull request, run schema deltas, or perform destructive operations.
- Preserve unrelated and pre-existing dirty changes.

ACCEPTANCE
- <Concrete behavior or artifact that must be true>
- <Regression and compatibility conditions>

TDD
- TDD_REQUIRED: <yes for feature/bugfix/refactor/behavior change | no with exact reason>
- Test seam: <observable behavior>
- RED command and expected failure: <exact command and missing behavior>
- GREEN command and expected success: <exact command>
- REFACTOR command and expected still-passing result: <exact command>
- Tests and RED evidence must precede production-code changes when TDD_REQUIRED is yes

IRONCLAD EVIDENCE
- Read targets and trace all dependents before editing
- Report blast radius and risk
- Apply the required strategy from `107-speckit-implement`
- Do not run repository-wide verification unless explicitly assigned

VERIFICATION
- Run: <exact focused command>
- Success: <expected exit status or output>
- Candidate-wide verification remains orchestrator-owned

RETURN
STATUS: complete | partial | blocked
TASKS: <IDs>
CHANGES: <actual file-by-file diff summary>
VERIFIED: <commands and observed results>
TDD EVIDENCE: <RED/GREEN/REFACTOR in `_LCBP3-CONTRACTS.md` format>
BLAST RADIUS: <dependents and risk>
JUDGMENT CALLS: <decisions or none>
GAPS: <unfinished checks/blockers or none>
TOUCHED OUTSIDE OWNERSHIP: <paths or none>
```

Prompt the worker to inspect current repository state before editing and to stop if the baseline or ownership assumptions are false.

### 4. Dispatch Safe Waves

Before the first wave, perform a permission pre-flight. Background agents cannot request new approvals. Confirm that write/edit and required focused execution tools have already been approved in the root session. If this cannot be established, launch the first implementation worker in the foreground to obtain approvals or run all write workers in the foreground; do not start a background wave that is expected to fail.

For each wave:

1. Launch mutually independent implementation units as background `subagent_general` agents only when the permission pre-flight passed; otherwise dispatch them in the foreground one at a time.
2. Do not launch a dependent unit in the same wave as its predecessor.
3. Record each returned agent ID in the scheduling table and ledger checkpoint notes.
4. Continue only with orchestrator-safe read-only work while workers run. Do not edit worker-owned files.
5. After completion notification, use `read_subagent` with the recorded agent ID to collect each result. Do not poll repeatedly.
6. If a worker is blocked by denied permissions, resume the same agent in the foreground with the unchanged packet plus the exact blocker.
7. If a worker returns `partial` or `blocked`, keep its tasks unchecked and decide whether to resume it, narrow the unit, execute inline, or ask the user.

### 5. Validate Worker Output

For each completed worker, before review:

1. Compare current repository state with the dispatch baseline and pre-existing dirty files.
2. Inspect `git diff --stat`, `git diff --name-only`, and focused diffs for the owned scope.
3. Confirm no files outside ownership were changed. If they were, stop that unit and classify the overlap before any further dispatch.
4. Verify the claimed tests and TDD evidence are concrete and chronologically valid.
5. Run the orchestrator's focused verification when safe; do not accept a worker's textual claim alone.
6. Confirm no forbidden operation occurred and no unrelated user edits were overwritten.
7. Set status to `worker-complete` only after this validation.

Do not mark `tasks.md` yet.

### 6. Independent Review Gate

Every implementation unit requires review by a separate agent that did not implement it.

Provide the reviewer:

- exact task IDs and acceptance criteria;
- worker-owned files and actual diff;
- relevant spec/ADR paths;
- worker TDD and verification evidence;
- pre-existing dirty-file context;
- explicit instruction to follow the Reviewer Evidence Bar in `_LCBP3-CONTRACTS.md`;
- explicit instruction not to modify files or delegate.

The reviewer must return:

```text
VERDICT: APPROVE | REQUEST_CHANGES | BLOCKED
SCOPE REVIEWED: <files and diff range>
BLOCKING FINDINGS: <each with violated contract, reachable path, impact, file lines, evidence gap, fix>
NON-BLOCKING FINDINGS: <residual risks and suggestions>
EVIDENCE REVIEWED: <tests, commands, specs>
GAPS: <unreviewed areas or none>
```

Reviewer findings are blocking only if they satisfy the full evidence bar. Style preferences and speculative concerns are non-blocking.

### 7. Fix-and-Re-Review Loop

When review requests changes:

1. Keep the unit in `changes-requested`; do not dispatch dependents.
2. Prefer resuming the original implementation agent with the review findings, unchanged ownership, and focused verification requirements.
3. Validate the new diff and evidence again.
4. Use a fresh independent reviewer or resume the original reviewer only to verify its specific findings. The implementer must never self-approve.
5. Limit to two automatic fix cycles. After two unsuccessful cycles, conflicting reviews, ownership expansion, or architectural ambiguity, stop and ask the user for direction.

### 8. Close a Unit and Phase

A unit becomes `verified` only when:

- implementation output matches the actual diff;
- ownership is clean;
- focused tests pass;
- TDD evidence is complete or explicitly not applicable with a valid reason;
- independent review returns `APPROVE` with no blocking gaps.

Only then may the root orchestrator:

1. Mark the task IDs `[X]` in `tasks.md`.
2. Append the assurance-ledger checkpoint.
3. Release dependent units.

At each phase gate:

1. Confirm all phase tasks are `verified`.
2. Run phase-level typecheck/tests and required static checks.
3. Inspect aggregate phase diff for cross-unit integration errors and unrelated changes.
4. Run an independent phase review when the phase is Tier 1, Tier 3, touches more than one module, or changes a public API/schema/security boundary.
5. Update the ledger and only then open the next phase.

If a phase gate fails, keep the next phase blocked and route the failure to the responsible worker or orchestrator-owned integration unit.

### 9. Final Candidate Gate

After all phases:

1. Re-read `spec.md`, `plan.md`, contracts, and acceptance criteria.
2. Confirm every required task is checked and every check maps to verified evidence.
3. Run project-required lint, typecheck, unit/integration/E2E tests, coverage, build, security checks, and diff review appropriate to scope.
4. Check the repository commit checklist, including UUID handling, TypeScript forbidden patterns, schema policy, error handling, i18n, cache invalidation, security, and coverage thresholds.
5. Run a final independent reviewer over the aggregate candidate diff using `final-strict` assurance mode.
6. Do not use `APPROVE` if verification was skipped, inconclusive, or environment-blocked; report `BLOCKED` or `PARTIAL` truthfully.
7. Finalize the ledger only when all required evidence and independent review pass.

## Failure and Recovery Rules

- **Agent unavailable or subagents disabled:** Explain the limitation and ask whether to continue with `107-speckit-implement` inline. Never pretend distribution occurred.
- **Worker timeout/interruption:** Read or resume the same agent; inspect repository state before reassignment.
- **Overlapping edits:** Stop affected units, preserve all changes, identify ownership, and serialize recovery. Never discard work automatically.
- **Unexpected dirty files:** Treat them as user/other-agent work until proven otherwise; exclude and report them.
- **Test regression:** Stop dependent dispatch, identify the introducing unit from diffs/evidence, and return it to fix-and-review.
- **Scope expansion:** Require a revised task packet and conflict analysis before touching new files.
- **Protected/destructive action required:** Stop and request explicit user confirmation for that exact action.
- **No matching custom assignee profile:** Use built-in profiles by capability; do not fabricate Codex/Claude/Devin identities.

## Progress Reporting

After each wave, report:

```text
DISTRIBUTED WAVE <N>
- Verified: <units/tasks>
- Changes requested: <units and blockers>
- Blocked: <units and reason>
- Next ready: <units>
- Active ownership: <worker -> files>
```

At completion, report:

- files changed by unit;
- tasks and phases completed;
- worker and reviewer verdicts;
- commands actually executed with results;
- TDD evidence locations;
- ADR/specs consulted;
- coverage and final-gate results;
- ledger location and terminal status;
- residual risks, ambiguities, and follow-up work.

## Anti-Patterns

Never:

- launch one agent per task without considering cost, dependencies, or file conflicts;
- run parallel agents against the same service/spec/test file;
- let workers mark `tasks.md`, update the ledger, commit, or claim phase completion;
- accept a worker's report without inspecting the actual repository;
- use the implementer as reviewer;
- mark downstream tasks ready from an unreviewed predecessor;
- hide partial verification behind an `APPROVE` verdict;
- discard or reset unexpected changes;
- allow nested delegation or uncontrolled fan-out.
