# Phase 0 Research: RFA Approval System Refactor

**Date**: 2026-05-11  
**Purpose**: Research technical patterns and validate design decisions

---

## Research Topics

### 1. Parallel Review in Workflow Engine

**Research Task**: Can Unified Workflow Engine (ADR-001) support parallel tasks with consensus rules?

**Decision**: ✅ **Yes, with DSL Extension**

**Rationale**:
- Current DSL supports sequential states and transitions
- Parallel review requires: (a) Task splitting on state entry, (b) Task aggregation before transition, (c) Consensus rule evaluation
- Pattern: `ParallelGateState` - enters sub-workflows for each Discipline, aggregates on completion

**Implementation Pattern**:
```typescript
// DSL Extension: Parallel Gateway
{
  type: 'parallel_gateway',
  config: {
    discriminator: 'discipline',  // Split by discipline
    minCompletion: 'majority',    // Consensus rule
    vetoConditions: [{ field: 'responseCode', value: '3' }] // Veto triggers
  }
}
```

**Alternatives Considered**:
- Option A: Multiple Workflow Instances per RFA (rejected - too complex, hard to aggregate)
- Option B: Sequential with fast-forward (rejected - doesn't truly parallelize)
- Option C: **Parallel Gateway in DSL** (selected - clean abstraction, reusable pattern)

**References**: 
- BPMN 2.0 Parallel Gateway pattern
- Existing `workflow-dsl.schema.ts` in codebase

---

### 2. Response Code Matrix Storage

**Research Task**: Best structure for Master Approval Matrix with 5 categories × 11 codes?

**Decision**: **Normalized Relational Model with JSON for flexibility**

**Rationale**:
- Core codes (1A-1G, 2, 3, 4) are stable relational data
- Category mappings (which codes apply to which doc types) need flexibility
- Project overrides need inheritance tracking

**Schema Design**:
```sql
-- Core Response Codes (stable)
response_codes (id, code, sub_status, description_th, description_en, category)

-- Matrix Rules (project-specific overrides)
response_code_rules (
  id, 
  project_id NULLABLE,  -- NULL = global default
  document_type_id,
  response_code_id,
  is_enabled,
  requires_comments,
  triggers_notification,
  parent_rule_id  -- For inheritance tracking
)
```

**Alternatives Considered**:
- Single JSON column for entire matrix (rejected - hard to query, validate, index)
- Full EAV (Entity-Attribute-Value) (rejected - too complex for this use case)

---

### 3. Delegation Pattern & Circular Detection

**Research Task**: Best approach for delegation with chain depth limit and circular detection?

**Decision**: **Adjacency List with Path Enumeration, Max Depth = 3**

**Rationale**:
- Adjacency List: Simple, fast for immediate lookup (`delegator_id → delegatee_id`)
- Path Enumeration: Store full chain as array for circular detection
- Max Depth 3: Prevents runaway chains while supporting realistic use cases

**Circular Detection Algorithm**:
```typescript
function detectCircularDelegation(delegatorId: string, proposedDelegateeId: string): boolean {
  // BFS/DFS from proposedDelegatee, check if can reach delegatorId
  const visited = new Set<string>();
  const queue = [proposedDelegateeId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === delegatorId) return true; // Circular!
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Add all delegatees of current
    const delegatees = getActiveDelegations(current);
    queue.push(...delegatees.map(d => d.delegateeId));
  }
  return false;
}
```

**Alternatives Considered**:
- Nested Set Model (rejected - overkill for simple chains)
- Closure Table (rejected - requires maintenance on delegation expiry)

---

### 4. BullMQ Pattern for Reminders & Distribution

**Research Task**: Best BullMQ patterns for scheduled reminders and async distribution?

**Decision**: **Delayed Jobs + Repeatable Jobs + Flows**

**Pattern Breakdown**:

**Reminders**:
- **Delayed Jobs**: Schedule individual reminder at due date
- **Repeatable Jobs**: Daily reminder for overdue items (cron pattern)
- **Job Data**: `{ rfaId, reviewerId, reminderType, escalationLevel }`

**Distribution**:
- **Job Flow**: Parent (distribution coordinator) → Children (individual deliveries)
- **Retry**: 3 attempts with exponential backoff
- **Dead Letter**: Failed distributions logged for manual intervention

```typescript
// Reminder Queue Pattern
await reminderQueue.add('rfa-reminder', {
  rfaRevisionId,
  reviewerId,
  reminderType: 'DUE_SOON'
}, {
  delay: calculateDelay(dueDate, reminderDaysBefore)
});

// Distribution Flow Pattern
await distributionFlow.add({
  name: 'rfa-distribution',
  data: { rfaId, responseCode, recipients: [...] },
  children: recipients.map(r => ({
    name: 'deliver-document',
    data: { recipientId: r.id, method: r.deliveryMethod }
  }))
});
```

**Alternatives Considered**:
- node-cron for scheduling (rejected - no persistence, no retry)
- Custom scheduler service (rejected - BullMQ already provides this)

---

### 5. Review Task Status Aggregation

**Research Task**: How to efficiently calculate aggregate status for parallel reviews?

**Decision**: **Materialized View + Real-time Counter**

**Rationale**:
- Materialized View: Fast reads for list views ("2 of 3 approved")
- Real-time Counter: Immediate update on each review action
- Trigger: Update counter on ReviewTask status change

**Aggregation Logic**:
```sql
-- Materialized view for fast reads
CREATE VIEW review_task_summary AS
SELECT 
  rfa_revision_id,
  COUNT(*) as total_disciplines,
  SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN response_code = '3' THEN 1 ELSE 0 END) as rejected_count
FROM review_tasks
GROUP BY rfa_revision_id;

-- Real-time consensus check
SELECT CASE 
  WHEN rejected_count > 0 THEN 'REJECTED'  -- Veto triggered
  WHEN completed = total_disciplines THEN 
    CASE 
      WHEN approved_count / total_disciplines >= 0.5 THEN 'APPROVED'
      ELSE 'NEEDS_REVIEW'
    END
  ELSE 'IN_PROGRESS'
END as consensus_status
FROM review_task_summary;
```

**Alternatives Considered**:
- Calculate on-demand (rejected - slow with many disciplines)
- Application-level cache (rejected - stale data risk)

---

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Parallel Review | DSL Parallel Gateway | Clean abstraction, reusable |
| Response Code Storage | Normalized + JSON | Balance of structure and flexibility |
| Delegation | Adjacency List + Path Enum | Simple, sufficient for depth ≤3 |
| Queue Pattern | BullMQ Delayed + Flows | Industry standard, reliable |
| Status Aggregation | Materialized View + Counter | Fast reads, real-time updates |

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|------------|
| DSL Parallel Gateway complexity | Medium | Prototype with simple 2-discipline case first |
| Response Code migration from existing | Low | New tables, existing data untouched |
| Performance on large Review Teams | Low | Pagination on aggregation, Redis caching |
| Circular delegation algorithm | Low | Unit test with 3-level chains |

---

## Next Phase

**Phase 1**: Design data model and API contracts based on these research decisions.
