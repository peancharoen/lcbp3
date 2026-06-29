---
title: Workflow Engine + Document Numbering + Workflow Context (ADR-001 / 002 / 021)
impact: CRITICAL
impactDescription: DSL-based state machine; double-lock numbering; integrated workflow context exposed to clients.
tags: workflow, numbering, redlock, version-column, adr-001, adr-002, adr-021
---

## Workflow Engine + Numbering + Context

LCBP3 uses a **unified workflow engine** (DSL-based state machine) across RFA, Transmittal, Correspondence, Circulation, and Shop Drawing. Every state transition goes through the same engine — no per-type routing tables.

---

## ADR-001: Unified Workflow Engine

### State Transition Pattern

```typescript
@Injectable()
export class WorkflowEngine {
  async transition(
    instanceId: string,
    action: WorkflowAction,
    actor: User,
    context?: WorkflowContext,
  ): Promise<WorkflowInstance> {
    // 1. Load current state from DB (never trust client-provided state)
    const instance = await this.repo.findOneByPublicId(instanceId);
    if (!instance) throw new NotFoundException();

    // 2. Validate transition against DSL
    const dsl = await this.dslService.load(instance.workflowTypeId);
    const nextState = dsl.resolve(instance.currentState, action);
    if (!nextState) {
      throw new BusinessException(
        `Action ${action} not allowed from state ${instance.currentState}`,
        'ไม่สามารถดำเนินการนี้ได้ในสถานะปัจจุบัน',
        'กรุณาตรวจสอบขั้นตอนการอนุมัติ',
        'WF_INVALID_TRANSITION',
      );
    }

    // 3. Apply transition atomically (optimistic lock via @VersionColumn)
    instance.currentState = nextState;
    await this.repo.save(instance); // throws OptimisticLockVersionMismatchError on race

    // 4. Emit event for listeners (notifications via BullMQ — ADR-008)
    this.eventBus.publish(new WorkflowTransitionedEvent(instance, action, actor));

    return instance;
  }
}
```

### ❌ Anti-Patterns

- ❌ Hard-coded `switch (state)` in controllers/services
- ❌ Trusting `currentState` from request body
- ❌ Creating separate routing tables per document type

---

## ADR-002: Document Numbering (Double-Lock)

Concurrent requests for a new document number **must** use both:

1. **Redis Redlock** — distributed lock across app instances
2. **TypeORM `@VersionColumn`** — optimistic lock on counter row

### Counter Entity

```typescript
@Entity('document_number_counters')
@Unique(['projectId', 'documentTypeId'])
export class DocumentNumberCounter extends UuidBaseEntity {
  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'document_type_id' })
  documentTypeId: number;

  @Column({ name: 'last_number', default: 0 })
  lastNumber: number;

  @VersionColumn()
  version: number; // ❗ Optimistic lock — do not rename, do not remove
}
```

### Service Pattern

```typescript
@Injectable()
export class DocumentNumberingService {
  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    private redlock: RedlockService,
    private readonly logger: Logger,
  ) {}

  async generateNext(ctx: NumberingContext): Promise<string> {
    const lockKey = `doc_num:${ctx.projectId}:${ctx.documentTypeId}`;

    // Distributed lock — 3s TTL, up to 5 retries
    const lock = await this.redlock.acquire([lockKey], 3000);

    try {
      // Optimistic lock via @VersionColumn
      const counter = await this.counterRepo.findOne({
        where: { projectId: ctx.projectId, documentTypeId: ctx.documentTypeId },
      });

      if (!counter) {
        throw new NotFoundException('Counter not initialized for this project/type');
      }

      counter.lastNumber += 1;
      await this.counterRepo.save(counter); // may throw OptimisticLockVersionMismatchError

      return this.formatNumber(ctx, counter.lastNumber);
    } catch (err) {
      if (err instanceof OptimisticLockVersionMismatchError) {
        this.logger.warn(`Numbering race detected for ${lockKey}, retrying`);
        // Let caller retry via BullMQ retry policy
      }
      throw err;
    } finally {
      await lock.release();
    }
  }

  private formatNumber(ctx: NumberingContext, seq: number): string {
    // e.g. "LCBP3-RFA-0042"
    return `${ctx.projectCode}-${ctx.typeCode}-${String(seq).padStart(4, '0')}`;
  }
}
```

### ❌ Anti-Patterns

- ❌ App-side counter only (`let counter = 0; counter++`)
- ❌ Using `findOne` + `update` without `@VersionColumn`
- ❌ Using only Redis lock without DB optimistic lock (race if Redis fails)

---

## ADR-021: Integrated Workflow Context

Every workflow-aware API response **must** expose:

```typescript
export class WorkflowEnvelope<T> {
  data: T;

  workflow: {
    instancePublicId: string;
    currentState: string;       // e.g. 'pending_review'
    availableActions: string[]; // e.g. ['approve', 'reject', 'request-revision']
    canEdit: boolean;           // computed from CASL + current state
    lastTransitionAt: string;   // ISO 8601
  };

  stepAttachments?: Array<{     // files produced by the current/previous step
    publicId: string;
    fileName: string;
    stepCode: string;
    downloadUrl: string;
  }>;
}
```

Frontend uses `workflow.availableActions` to render buttons — no client-side state machine logic.

---

## Reference

- [ADR-001 Unified Workflow Engine](../../../../specs/06-Decision-Records/ADR-001-unified-workflow-engine.md)
- [ADR-002 Document Numbering Strategy](../../../../specs/06-Decision-Records/ADR-002-document-numbering-strategy.md)
- [ADR-021 Workflow Context](../../../../specs/06-Decision-Records/ADR-021-workflow-context.md)
