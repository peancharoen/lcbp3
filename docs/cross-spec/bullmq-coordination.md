# Cross-Spec: BullMQ Queue Coordination

**Date**: 2026-05-16  
**Features**: 204-rfa-approval-refactor + 302-ai-model-revision  
**Document**: Coordination strategy for shared BullMQ infrastructure

---

## Queue Overview

| Queue | Feature | Job Types | Priority | Notes |
|-------|---------|-----------|----------|-------|
| `ai-realtime` | AI Model Revision | ai-suggest, rag-query | HIGH | Interactive, must not be blocked |
| `ai-batch` | AI Model Revision | ocr, extract-metadata, embed-document | LOW | Batch processing, can be paused |
| `rfa-reminders` | RFA Approval | reminder-send, escalation | MEDIUM | Scheduled notifications |
| `rfa-distribution` | RFA Approval | distribute-document | MEDIUM | Post-approval distribution |

---

## Coordination Rules

### 1. Queue Isolation

```typescript
// AI queues are isolated from RFA queues
// Each feature has dedicated queue names
export const QUEUE_AI_REALTIME = 'ai-realtime';
export const QUEUE_AI_BATCH = 'ai-batch';
export const QUEUE_RFA_REMINDERS = 'rfa-reminders';
export const QUEUE_RFA_DISTRIBUTION = 'rfa-distribution';
```

### 2. Priority Strategy

| Priority Level | Queue | Use Case |
|---------------|-------|----------|
| 1 (Highest) | ai-realtime | User-facing AI suggestions |
| 2 | rfa-reminders | Due date notifications |
| 3 | rfa-distribution | Document distribution |
| 4 (Lowest) | ai-batch | Background embedding |

### 3. Auto-Pause Mechanism

```typescript
// AI Realtime Processor pauses ai-batch when active
@OnWorkerEvent('active')
async onActive() {
  await this.aiBatchQueue.pause();
}

@OnWorkerEvent('completed')
@OnWorkerEvent('failed')
async onCompletedOrFailed() {
  await this.aiBatchQueue.resume();
}
```

### 4. Concurrency Limits

| Queue | Concurrency | Reason |
|-------|-------------|--------|
| ai-realtime | 1 | GPU sharing with ai-batch |
| ai-batch | 1 | GPU sharing with ai-realtime |
| rfa-reminders | 5 | Email notifications can batch |
| rfa-distribution | 3 | Transmittal creation moderate |

### 5. Conflict Prevention

- **No job name conflicts**: Each job type has unique naming
- **No data cross-contamination**: Different payloads per queue
- **Separate Redis keys**: Queue prefixes ensure isolation

---

## Monitoring

Check queue status:
```bash
# Redis CLI
redis-cli KEYS "bull:*"

# Check queue lengths
redis-cli LLEN "bull:ai-realtime:wait"
redis-cli LLEN "bull:rfa-reminders:wait"
```

---

## Verification Checklist

- [x] `ai-realtime` and `ai-batch` have auto-pause/resume
- [x] `rfa-reminders` doesn't block AI queues
- [x] All queues have unique names
- [x] Concurrency configured per queue
- [x] Priority levels documented
