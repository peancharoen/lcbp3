# AI Pipeline Assurance Ledger

> For ADR-023/ADR-042 AI runtime, OCR, RAG, or sandbox work that spans sessions.
> All AI processing must route through DMS API -> BullMQ; direct Ollama/Qdrant access is a protected boundary violation.

## Identity

- ASSURANCE_UNIT_ID: `lcbp3/ai/<component>-phase-<N>`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `specs/200-fullstacks/<feature>/ai-ledger.md`
- STATUS: `open`

## Authority and Boundary

- Objective: `<what AI capability is being built or changed>`
- Acceptance criteria:
  1. AI Gateway endpoint with validation and audit logging
  2. BullMQ queue (ai-realtime or ai-batch) configured with correct concurrency
  3. Ollama/Qdrant access only via DMS API -> BullMQ (no direct calls)
  4. `projectPublicId` filter enforced in Qdrant operations
  5. Human-in-the-loop validation points identified
  6. GPU overload prevention tested (concurrency=1, keep_alive adaptive)
- Base state:
  - Branch: `<branch>`
  - Ref: `<commit>`
  - Model stack: `np-dms-ai + np-dms-ocr + BGE-M3 + BGE-Reranker`
  - AI runtime host: `np-dms-lcbp3`
- Declared final boundary: `<condition that ends this AI unit>`
- Protected boundaries:
  - Direct Ollama/Qdrant calls from backend/frontend/n8n
  - Cloud AI services
  - Production deployment without audit logging
  - Bypassing human-in-the-loop for high-confidence thresholds

## Verification Profile

- FOCUSED_CHECKS:
  - `pnpm --filter backend test <ai-component>`
  - `curl` test against AI Gateway endpoint
- CANDIDATE_CHECKS:
  - `pnpm --filter backend test`
  - BullMQ queue health check
  - Qdrant search filter verification
- COMPOSE_CHECK:
  - `<local Ollama/Qdrant compose command or not-applicable>`

## Checkpoints

| ID | Scope changed | Verification commands/results | TDD evidence | Known gaps | Status |
| -- | ------------- | ----------------------------- | ------------ | ---------- | ------ |
|    |               |                               |              |            |        |

## AI-Specific Risks

- Model version drift: `<yes/no with mitigation>`
- Prompt injection surface: `<list of inputs>`
- PII/sensitive data exposure: `<yes/no with mitigation>`
- GPU queue saturation risk: `<yes/no with mitigation>`
- Multi-tenant isolation gap: `<yes/no with mitigation>`

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
