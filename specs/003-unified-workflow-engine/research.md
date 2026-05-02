# Research: Unified Workflow Engine — Production Hardening Decisions

**Phase 0 Output** | Generated: 2026-05-02  
**Builds on**: `specs/08-Tasks/ADR-021-workflow-context/research.md` (attachment strategy, FK structure, UUID type — all resolved previously)

---

## Decision 1: Optimistic Lock Strategy for `processTransition()` (FR-002)

**Question:** `processTransition()` already uses `pessimistic_write` DB lock. ADR-001 v1.1 requires adding `version_no` optimistic lock. Should they co-exist or replace?

### Option A: Replace pessimistic with optimistic (Selected ❌)

Remove `lock: { mode: 'pessimistic_write' }` and rely solely on `version_no` CAS.

**Cons:**
- Two concurrent requests with different `version_no` values still cause a race window between the DB read and the UPDATE
- Redlock already acquired before DB transaction — removing pessimistic adds no benefit to latency

### Option B: Dual-layer defense-in-depth (Selected ✅)

Keep `pessimistic_write` inside the transaction. Add `version_no` check as a **fast-fail before Redlock acquisition**.

**Flow:**
```
Client sends { action, version_no: N }
    ↓
[Fast-fail] Read instance.version_no from DB (no lock)
    If N ≠ instance.version_no → HTTP 409 immediately (no Redlock acquired)
    ↓
[Acquire Redlock]
    ↓
[DB Transaction with pessimistic_write]
    Re-check version_no under lock (TOCTOU defense)
    If still mismatch → 409 and release lock
    Else: commit + increment version_no
```

**Pros:**
- Fast-fail saves Redlock round-trip for stale clients (SC-001 — no double approvals)
- Inner pessimistic lock prevents any residual race within the DB transaction
- Defense-in-depth: two independent barriers

**Decision:** Option B — dual-layer.  
**Rationale:** Zero latency regression for non-conflicting requests; stale-client 409 fired before lock acquisition; inner lock remains for cross-process correctness.

---

## Decision 2: DSL `require.role` → CASL Ability Mapping (FR-002a)

**Question:** How should the guard resolve DSL `require.role: ["Admin"]` against the CASL permission model?

### Option A: Static config map in guard (Selected ✅)

```typescript
const DSL_ROLE_TO_CASL: Record<string, string> = {
  'Superadmin':      'system.manage_all',
  'OrgAdmin':        'organization.manage_users',
  'ContractMember':  'contract.view',
  'AssignedHandler': '__assigned__',
};
```

Guard resolves each DSL role string → CASL permission string → `userPermissions.includes(mapped)`.

**Pros:**
- No new DB tables or config entities
- Testable in isolation (mock `userPermissions`)
- Backward-compatible: unknown DSL roles fall through to `__assigned__` check

### Option B: Dynamic mapping table in DB (Rejected ❌)

Store DSL role → CASL ability mappings in a new `workflow_role_mappings` table.

**Cons:**
- New table requires ADR-009 delta + entity + service
- Over-engineering for a mapping that changes rarely
- Adds DB query to every transition guard check

**Decision:** Option A — static config map.  
**Rationale:** The mapping is stable (tied to ADR-016 RBAC levels); config-driven in code is sufficient and avoids over-engineering.

---

## Decision 3: Per-Transition Prometheus Metrics (FR-023)

**Question:** The existing service has Redlock-specific metrics. Where should workflow-level transition metrics be registered?

### Existing metrics (keep)
- `workflow_redlock_acquire_duration_ms` (Histogram)
- `workflow_redlock_acquire_failures_total` (Counter)

### New metrics needed
- `workflow_transitions_total` (Counter, labels: `workflow_code`, `action`, `outcome`)
- `workflow_transition_duration_ms` (Histogram, labels: `workflow_code`)

**Registration approach:** Add `makeCounterProvider` and `makeHistogramProvider` in `workflow-engine.module.ts` via `@willsoto/nestjs-prometheus`. Inject with `@InjectMetric('workflow_transitions_total')`.

**Outcome label values:**
- `success` — transition committed
- `conflict` — optimistic lock mismatch (409) or TOCTOU
- `forbidden` — CASL guard rejection (403)
- `validation_error` — DSL condition failed (422)
- `system_error` — unexpected exception (500)

**Decision:** Register in `WorkflowEngineModule`; inject into `WorkflowEngineService`; record in `processTransition()` try/catch/finally block.

---

## Decision 4: DSL Definition Redis Cache Pattern (FR-007)

**Question:** Cache key format, TTL, and invalidation strategy for `workflow_definitions`.

### Cache key design
```
wf:def:{workflow_code}:{version}   → single definition
wf:def:{workflow_code}:active      → pointer to active version (for fast active lookup)
```

### Invalidation triggers
| Event | Action |
|-------|--------|
| `createDefinition()` | SET new key; leave old active pointer |
| `update()` — DSL change | DEL old key; SET updated key |
| `is_active = true` | SET `wf:def:{code}:active`; DEL previous active pointer |
| `is_active = false` | DEL `wf:def:{code}:active` |

### TTL: 3600 seconds (1 hour). Acceptable stale window for inactive definitions; active pointer is always invalidated on toggle.

**Decision:** Two-key pattern with a separate `:active` pointer key. Invalidate pointer immediately on `is_active` change → satisfies SC-005 (< 1s invalidation).

---

## Decision 5: BullMQ Dead-Letter Queue Architecture (FR-005, FR-006)

**Question:** How to implement `workflow-events-failed` DLQ with n8n webhook notification?

### Option A: Separate `workflow-events-failed` queue (Selected ✅)

```typescript
// WorkflowEventProcessor
@OnWorkerEvent('failed')
async onFailed(job: Job, error: Error) {
  if (job.attemptsMade >= job.opts.attempts) {
    // All retries exhausted → DLQ + webhook
    await this.failedQueue.add('dead-letter', { jobId: job.id, ...job.data });
    await this.notifyOps(job, error);
  }
}
```

**Pros:**
- Failed jobs visible in Bull Board under `workflow-events-failed`
- Can be requeued manually via Bull Board UI
- n8n only notified on final failure (not on intermediate retries)

### Option B: BullMQ native `removeOnFail: false` only (Rejected ❌)

Keep jobs in `workflow-events` completed/failed states, no separate queue.

**Cons:**
- Bull Board has no separate DLQ view
- No ops notification mechanism
- Harder to isolate and requeue failed jobs

**Decision:** Option A — separate `workflow-events-failed` queue.  
**n8n webhook:** Send via `fetch(process.env.N8N_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(payload) })`. Guard with `if (!process.env.N8N_WEBHOOK_URL)` to avoid hard failure in dev environment.

---

## Decision 6: Admin DSL Editor — JSON Editor Library (FR-024, FR-025)

**Question:** Which JSON editor library for the DSL authoring UI?

### Option A: Monaco Editor (`@monaco-editor/react`) (Selected ✅)

Full VS Code-like editor with JSON syntax highlighting, bracket matching, and inline error markers.

**Pros:**
- Inline error decoration (squiggle underlines) — satisfies FR-025 inline validation feedback
- JSON schema validation via `monaco.languages.json.jsonDefaults.setDiagnosticsOptions()`
- Familiar to developers
- Already potentially used elsewhere in admin UIs

**Cons:**
- ~2MB bundle (lazy loaded via `dynamic(() => import('@monaco-editor/react'), { ssr: false })`)

### Option B: CodeMirror 6 (`@uiw/react-codemirror`) (Alternative)

Lighter (~400KB for JSON extension).

**Cons:**
- No native JSON Schema validation; requires custom linting extension
- Inline error decoration requires manual setup

**Decision:** Option A — Monaco Editor, lazy-loaded. The bundle cost is acceptable for an Admin-only page (not user-facing); inline validation is a critical FR-025 requirement.  
**DSL Schema**: Provide the compiled DSL JSON Schema to Monaco for inline validation → errors shown before the user clicks Save.

---

## Carry-Forward from Prior Research

The following decisions from `specs/08-Tasks/ADR-021-workflow-context/research.md` remain valid and are not re-litigated:

- **File attachment strategy**: Upload-then-reference (Two-Phase, ADR-016) ✅
- **FK structure**: Direct `workflow_history_id` on `attachments` table ✅
- **UUID type for `workflow_histories.id`**: CHAR(36) UUID direct PK ✅
- **Redlock scope**: Transition-level Redlock (not document-numbering Redlock) ✅
- **Preview endpoint**: Use existing `/api/files/{publicId}` with `Content-Disposition: inline` ✅
