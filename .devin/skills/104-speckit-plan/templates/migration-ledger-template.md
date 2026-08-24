# Migration Assurance Ledger

> For ADR-028 migration pipeline work that spans sessions or involves data transformation risk.
> Migration **execution** on production is a protected boundary — do not cross while ledger status is `open` or `checkpoint-ready`.

## Identity

- ASSURANCE_UNIT_ID: `lcbp3/migration/<source>-to-<target>-phase-<N>`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `specs/06-Decision-Records/ADR-028-ledger-<source>-<target>.md`
- STATUS: `open`

## Authority and Boundary

- Objective: `<what data/process is being migrated and why>`
- Acceptance criteria:
  1. Source data mapped and validated against canonical schema
  2. Transform logic covered by tests or verified samples
  3. Staging queue populated without data loss
  4. Reconciliation report passes tolerance threshold
  5. Cleanup tasks scheduled and verified
- Base state:
  - Branch: `<branch>`
  - Ref: `<commit>`
  - Source schema version: `<version>`
  - Target schema version: `<version>`
- Declared final boundary: `<condition that ends migration unit>`
- Protected boundaries:
  - Production migration execution
  - Destructive cleanup without backup verification
  - Disablement of existing validation gates

## Verification Profile

- FOCUSED_CHECKS:
  - `pnpm --filter backend test <migration-scope>`
  - `node scripts/verify-migration-mapping.js <sample>`
- CANDIDATE_CHECKS:
  - `pnpm --filter backend test`
  - Reconciliation diff against source extract
- COMPOSE_CHECK:
  - `<command to run migration container locally or not-applicable>`

## Checkpoints

| ID | Scope changed | Verification commands/results | TDD evidence | Known gaps | Status |
| -- | ------------- | ----------------------------- | ------------ | ---------- | ------ |
|    |               |                               |              |            |        |

## Migration-Specific Risks

- Data loss tolerance: `<number or none>`
- Idempotency requirement: `<yes/no>`
- Rollback window: `<time or not-applicable>`
- Downtime allowed: `<yes/no>`

## Review Attempts

| Attempt | State | Verdict | Reviewer | Notes |
| ------- | ----- | ------- | -------- | ----- |
|         |       |         |          |       |

## Terminal Status

- FINAL_STATUS: `<complete | blocked | abandoned>`
- INDEPENDENT_ATTESTATION: `<not-applicable | reviewer-ship | not-obtained>`
- KNOWN_BLOCKERS: `<none | exact blockers>`
- Residual risks: `<list or none>`

## Next Session Entry

- Last action taken:
- Next required action:
- Files/agent must not touch:
