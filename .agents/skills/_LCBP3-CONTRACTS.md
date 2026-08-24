# LCBP3 Bounded Work Contracts

Reference contracts for delegating implementation, reviewing changes, and tracking cross-session work in the LCBP3-DMS codebase. Adapted from the Solweaver bounded-agent model to fit LCBP3 conventions (AGENTS.md, ADR-019, ADR-016, ADR-023, ADR-044, Speckit skills).

These contracts apply when an orchestrator delegates a bounded task to another worker skill, when a reviewer evaluates a candidate change, or when a coherent unit of work must survive across chat sessions. They do not replace AGENTS.md; they operationalize its Tier 1/2/3 gates into actionable packets, evidence bars, and durable ledgers.

---

## 1. Worker Task Packet

Use this packet whenever implementation is delegated to a bounded worker (for example: `create-backend-module`, `create-frontend-page`, a task from `tasks.md`, or a subagent call). The packet must be provided **before** the worker edits files.

```text
WORKER TASK PACKET

ROLE
Act as the assigned implementation worker. You are not alone in the codebase.
Preserve unrelated edits and own only the scope below.

EXECUTION MODE
<inline | subagent>

ASSURANCE MODE
<standard | final-strict>

OBJECTIVE
- Observable outcome and why it matters.

OWNERSHIP
- Own: <exact files, modules, or bounded responsibility>
- Do not touch: <excluded files, modules, generated artifacts, or other work>

CONSTRAINTS
- Follow AGENTS.md and all applicable ADRs.
- For ADR-019: use publicId (string UUID) only; never parseInt/Number/+ on UUID; never expose internal INT id.
- For ADR-016: respect RBAC/CASL guards, two-phase file upload, and ClamAV scanning.
- For ADR-023: never allow AI direct database/storage access; route through DMS API -> BullMQ.
- For ADR-044: verify schema in specs/03-Data-and-Storage/ before writing queries or migrations.
- Do not deploy, mutate production, merge, push, open a pull request, or execute destructive operations.
- Return a blocker before changing files outside ownership.

ACCEPTANCE
- <Concrete behavior or artifact that must be true>
- <Regression or compatibility condition>

TDD
- TDD_REQUIRED: <yes for feature/bugfix/refactor/behavior change | no with exact reason>
- When required, write or update the failing test/RED command before production code.
- Test seam: <observable public behavior, function signature, API endpoint, or UI interaction>
- RED command and expected failure: <exact focused command and missing behavior>
- GREEN and REFACTOR evidence: <expected focused commands>

VERIFICATION
- Run: <exact focused command>
  Success: <expected exit status or output>
- Candidate-wide verify/Compose ownership: orchestrator unless explicitly assigned.
- Do not run repository-wide verify, full E2E, or full Compose rehearsal during implementation unless this packet explicitly assigns the candidate gate.

RETURN
STATUS: complete | partial | blocked
CHANGES: <file-by-file summary from the actual diff>
VERIFIED: <commands run and concrete results>
TDD EVIDENCE: <observed RED, GREEN, REFACTOR per behavior slice, or justified not-applicable>
JUDGMENT CALLS: <decisions made, or none>
GAPS: <unfinished work, unrun checks, blockers, or none>
```

---

## 2. Reviewer Evidence Bar

A reviewer finding is **blocking** only when it establishes all of the following. Non-blocking observations belong in a "Residual Risk" or "Suggestions" section.

| #   | Required Element      | Description                                                                                                           |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | **Violated contract** | The exact acceptance criterion, ADR, security rule, repository convention, or invariant that is broken.               |
| 2   | **Reachable path**    | A concrete input, state transition, race condition, rollback scenario, failing observation, or material evidence gap. |
| 3   | **Impact**            | The effect on correctness, security, data integrity, tenant isolation, compatibility, or user-visible behavior.       |
| 4   | **File references**   | Precise file paths and line numbers or ranges inside the reviewed scope.                                              |
| 5   | **Evidence gap**      | Why existing tests, types, logs, or other evidence do not already close the issue.                                    |

### LCBP3 Tier 1 blocker examples

The following are automatically blocking if not justified with an accepted contract exception:

- **ADR-019 UUID misuse**: `parseInt()`/`Number()`/`+` on a UUID value; exposing internal INT `id` in an API response; using `id ?? ''` fallback.
- **ADR-016 Security**: missing CASL guard on a protected endpoint; raw SQL without parameterization; secrets in code; skipping two-phase upload or ClamAV scan.
- **ADR-023 AI boundary**: AI code directly queries the database or storage; n8n calls Ollama/Qdrant directly instead of through the DMS API -> BullMQ.
- **ADR-008 / ADR-002 Concurrency**: document numbering or workflow state transition without Redis Redlock or TypeORM `@VersionColumn`.
- **ADR-044 Schema**: table/column names invented without checking `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`.

### Missing tests

A missing test is blocking **only** when required or critical behavior lacks other direct proof. Style preferences, speculative future concerns, optional hardening, and low-confidence possibilities are not blockers.

---

## 3. TDD Evidence Format

For every feature, bug fix, refactor, or behavior change, record the following evidence. Tests written after implementation do not retroactively satisfy TDD.

```text
TDD EVIDENCE

- TDD_REQUIRED: <yes | no with exact reason>
- Test seam: <observable public behavior the test exercises>
- RED command: <exact focused command run before implementation>
- RED output: <observed failure or missing behavior>
- GREEN command: <exact focused command run after minimal implementation>
- GREEN output: <observed passing result>
- REFACTOR command: <command run after cleanup>
- REFACTOR output: <observed still-passing result>
- Permanent test location: <path to test file that remains in the repo, or none>
- Status: complete | partial | not-applicable
```

### Notes for LCBP3

- Backend tests should target the observable seam (service method, API endpoint, DTO validation) rather than implementation internals.
- Frontend tests should target component behavior or hook output, not just snapshot.
- A failing CI run or a test written after the implementation is not RED evidence.
- Documentation-only, configuration-only, research, operations-only, generated, or explicitly authorized throwaway work may be exempted with a concrete reason.

---

## 4. Cross-Session Assurance Ledger

Use this ledger when a single coherent unit of work (for example: a migration, AI pipeline refactor, multi-step workflow engine change, or large feature) spans more than one chat session, task, worktree, or branch. It preserves the state an AI agent needs in order to continue safely without relying solely on in-memory context.

This is a **lightweight** LCBP3 adaptation of Solweaver's durable ledger. It intentionally omits final-strict review reservation mechanics; those are handled by the project's existing review process (Gitea PR + `110-speckit-reviewer` / `112-speckit-security-audit`).

### When to create a ledger

Create or append a ledger when:

- The task is explicitly identified as high-risk or cross-session (Tier 3: ADR-021, ADR-028, ADR-042, AI runtime layer).
- You are stopping with incomplete work and another session must continue.
- Multiple agents or skills may touch the same scope over time.
- The work affects protected boundaries (auth, migration, data integrity, public API, AI boundary).

### Ledger location

Prefer an authoritative repository artifact when one exists:

- For a feature: `specs/200-fullstacks/feat-XXX/ledger.md`
- For a migration: `specs/06-Decision-Records/ADR-028-ledger.md`
- For AI pipeline work: `specs/200-fullstacks/feat-YYY/ai-ledger.md`
- For ad-hoc work without a feature folder: `specs/88-logs/session-ledger-<unit-id>.md`

The ledger must be inside the repo so it survives across sessions, worktrees, and machines. Do not store it in a temporary path or rely on AI memory.

### Ledger format

```markdown
# Assurance Ledger: <unit-name>

## Identity

- ASSURANCE_UNIT_ID: <repository>/<track>/<phase-or-delivery-id>
- REOPEN_GENERATION: <0 for first run, then +1 each explicit reopen>
- LEDGER_LOCATION: <path to this file>
- STATUS: open | checkpoint-ready | complete | blocked | abandoned

## Authority and Boundary

- Objective: <one coherent outcome>
- Acceptance criteria: <complete cumulative criteria>
- Base state: <exact ref, branch, worktree, initial dirty files>
- Declared final boundary: <condition that ends this unit>
- Protected boundaries: <migration execution, deploy, merge, production auth changes, real money — do not cross without final gate>

## Repository Verification Profile

- FOCUSED_CHECKS: <commands used during edits>
- CANDIDATE_CHECKS: <repository-wide commands>
- COMPOSE_CHECK: <command or not-applicable>

## Checkpoints

| Checkpoint | Changed scope | Parent verification | TDD evidence | Known gaps | Status           |
| ---------- | ------------- | ------------------- | ------------ | ---------- | ---------------- |
| <id>       | <files>       | <commands/results>  | <link/path>  | <gaps>     | checkpoint-ready |

## Review Attempts

| Attempt | State | Verdict | Notes |
| ------- | ----- | ------- | ----- |
| <none>  |       |         |       |

## Terminal Status

- FINAL_STATUS: <complete | blocked | abandoned>
- INDEPENDENT_ATTESTATION: <not-applicable | reviewer-ship | not-obtained>
- KNOWN_BLOCKERS: <none | exact blockers>
- Remaining risks: <list>

## Next Session Entry

- Last action taken: <what you did>
- Next required action: <what the next agent must do first>
- Files/agent must not touch: <excluded scope>
```

### Rules

1. **Stable identity**: `ASSURANCE_UNIT_ID` is derived from repository/track/phase, never from a chat thread, timestamp, or branch name. Renaming or splitting unchanged scope does not reset the ledger.
2. **One ledger per unit**: Do not create competing ledgers for the same scope. If a feature already has a ledger, append to it.
3. **Append-only**: When a session ends, append a checkpoint row. Do not delete or rewrite prior rows except to correct factual errors with a note.
4. **No protected-boundary crossing with open ledger**: A ledger in `open` or `checkpoint-ready` status must not cross a protected boundary (deploy, merge, migration execution, production auth). The status must be `complete` or explicitly authorized first.
5. **Handoff explicitly**: When starting a new session, read the ledger first and report the current `STATUS`, last checkpoint, and next action before making changes.
6. **Link evidence, don't duplicate**: Attach TDD evidence, test reports, and review reports by path rather than copying them inline.

### Relationship to Solweaver

This ledger borrows the `ASSURANCE_UNIT_ID`, `REOPEN_GENERATION`, checkpoint table, and terminal-status concepts from Solweaver's final-strict ledger, but it is deliberately simpler. It does **not** include:

- exclusive reviewer-call reservation locks,
- `FROZEN_CANDIDATE_ID` / `ASSURANCE_PACKET_ID` machine identity,
- machine-bound SHA-256 readiness proofs, or
- a fixed budget of reviewer calls.

Those mechanisms can be added later if a feature truly needs Solweaver-level rigor. For most LCBP3 cross-session work, the lightweight ledger above is sufficient.
