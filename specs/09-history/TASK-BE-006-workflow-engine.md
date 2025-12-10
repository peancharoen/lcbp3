# Task: Workflow Engine Module

**Status:** Completed
**Priority:** P0 (Critical - Core Infrastructure)
**Estimated Effort:** 10-14 days
**Dependencies:** TASK-BE-001 (Database), TASK-BE-002 (Auth)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Unified Workflow Engine ที่ใช้ DSL-based configuration สำหรับจัดการ Workflow ของ Correspondences, RFAs, และ Circulations

---

## Objectives

- ✅ DSL Parser และ Validator
- ✅ State Machine Management
- ✅ Workflow Instance Lifecycle
- ✅ Transition Execution
- ✅ History Tracking
- ✅ Notification Integration

---

## 📝 Acceptance Criteria

1. **Definition Management:**

   - ✅ Create/Update workflow from JSON DSL
   - ✅ Validate DSL syntax และ Logic
   - ✅ Version management
   - ✅ Activate/Deactivate definitions

2. **Instance Management:**

   - ✅ Create instance from definition
   - ✅ Execute transitions
   - ✅ Check guards (permissions, validations)
   - ✅ Trigger effects (notifications, updates)
   - ✅ Track history

3. **Integration:**
   - ✅ Used by Correspondence module
   - ✅ Used by RFA module
   - ✅ Used by Circulation module
   - ✅ Notification service integration

---

## 🛠️ Implementation Steps

### 1. Entities

```typescript
// File: backend/src/modules/workflow-engine/entities/workflow-definition.entity.ts
@Entity('workflow_definitions')
export class WorkflowDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column()
  version: number;

  @Column({ length: 50 })
  entity_type: string; // 'correspondence', 'rfa', 'circulation'

  @Column({ type: 'json' })
  definition: WorkflowDSL; // JSON DSL

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @Index(['name', 'version'], { unique: true })
  _nameVersionIndex: void;
}
```

```typescript
// File: backend/src/modules/workflow-engine/entities/workflow-instance.entity.ts
@Entity('workflow_instances')
export class WorkflowInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  definition_id: number;

  @Column({ length: 50 })
  entity_type: string;

  @Column()
  entity_id: number;

  @Column({ length: 50 })
  current_state: string;

  @Column({ type: 'json', nullable: true })
  context: any; // Runtime data

  @CreateDateColumn()
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'definition_id' })
  definition: WorkflowDefinition;

  @OneToMany(() => WorkflowHistory, (history) => history.instance)
  history: WorkflowHistory[];
}
```

```typescript
// File: backend/src/modules/workflow-engine/entities/workflow-history.entity.ts
@Entity('workflow_history')
export class WorkflowHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  instance_id: number;

  @Column({ length: 50, nullable: true })
  from_state: string;

  @Column({ length: 50 })
  to_state: string;

  @Column({ length: 50 })
  action: string;

  @Column()
  actor_id: number;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  transitioned_at: Date;

  @ManyToOne(() => WorkflowInstance, (instance) => instance.history)
  @JoinColumn({ name: 'instance_id' })
  instance: WorkflowInstance;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;
}
```

### 2. DSL Types

```typescript
// File: backend/src/modules/workflow-engine/types/workflow-dsl.type.ts
export interface WorkflowDSL {
  name: string;
  version: number;
  entity_type: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface WorkflowState {
  name: string;
  type: 'initial' | 'intermediate' | 'final';
  allowed_transitions: string[];
}

export interface WorkflowTransition {
  action: string;
  from: string;
  to: string;
  guards?: Guard[];
  effects?: Effect[];
}

export interface Guard {
  type: 'permission' | 'validation' | 'condition';
  permission?: string;
  rules?: string[];
  condition?: string;
}

export interface Effect {
  type: 'notification' | 'update_entity' | 'create_log';
  template?: string;
  recipients?: string[];
  field?: string;
  value?: any;
}
```

### 3. DSL Parser

```typescript
// File: backend/src/modules/workflow-engine/services/dsl-parser.service.ts
@Injectable()
export class DslParserService {
  parseDefinition(dsl: WorkflowDSL): ParsedWorkflow {
    this.validateStructure(dsl);
    this.validateStates(dsl);
    this.validateTransitions(dsl);

    return {
      states: this.parseStates(dsl.states),
      transitions: this.parseTransitions(dsl.transitions),
      stateMap: this.buildStateMap(dsl.states),
    };
  }

  private validateStructure(dsl: WorkflowDSL): void {
    if (!dsl.name || !dsl.states || !dsl.transitions) {
      throw new BadRequestException('Invalid DSL structure');
    }
  }

  private validateStates(dsl: WorkflowDSL): void {
    const initialStates = dsl.states.filter((s) => s.type === 'initial');
    if (initialStates.length !== 1) {
      throw new BadRequestException('Must have exactly one initial state');
    }

    const finalStates = dsl.states.filter((s) => s.type === 'final');
    if (finalStates.length === 0) {
      throw new BadRequestException('Must have at least one final state');
    }
  }

  private validateTransitions(dsl: WorkflowDSL): void {
    const stateNames = new Set(dsl.states.map((s) => s.name));

    for (const transition of dsl.transitions) {
      if (!stateNames.has(transition.from)) {
        throw new BadRequestException(`Unknown state: ${transition.from}`);
      }
      if (!stateNames.has(transition.to)) {
        throw new BadRequestException(`Unknown state: ${transition.to}`);
      }
    }
  }

  getInitialState(dsl: WorkflowDSL): string {
    const initialState = dsl.states.find((s) => s.type === 'initial');
    return initialState.name;
  }

  buildStateMap(states: WorkflowState[]): Map<string, WorkflowState> {
    return new Map(states.map((s) => [s.name, s]));
  }
}
```

### 4. Workflow Engine Service

```typescript
// File: backend/src/modules/workflow-engine/services/workflow-engine.service.ts
@Injectable()
export class WorkflowEngineService {
  constructor(
    @InjectRepository(WorkflowDefinition)
    private defRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowHistory)
    private historyRepo: Repository<WorkflowHistory>,
    private dslParser: DslParserService,
    private guardExecutor: GuardExecutorService,
    private effectExecutor: EffectExecutorService,
    private dataSource: DataSource
  ) {}

  async createInstance(
    definitionName: string,
    entityType: string,
    entityId: number,
    manager?: EntityManager
  ): Promise<WorkflowInstance> {
    const repo = manager || this.instanceRepo;

    //Get active definition
    const definition = await this.defRepo.findOne({
      where: { name: definitionName, entity_type: entityType, is_active: true },
      order: { version: 'DESC' },
    });

    if (!definition) {
      throw new NotFoundException(
        `Workflow definition not found: ${definitionName}`
      );
    }

    // Get initial state
    const initialState = this.dslParser.getInitialState(definition.definition);

    // Create instance
    const instance = repo.create({
      definition_id: definition.id,
      entity_type: entityType,
      entity_id: entityId,
      current_state: initialState,
      context: {},
    });

    return repo.save(instance);
  }

  async executeTransition(
    instanceId: number,
    action: string,
    actorId: number
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Get instance
      const instance = await manager.findOne(WorkflowInstance, {
        where: { id: instanceId },
        relations: ['definition'],
      });

      if (!instance) {
        throw new NotFoundException(
          `Workflow instance not found: ${instanceId}`
        );
      }

      // 2. Find transition
      const dsl = instance.definition.definition;
      const transition = dsl.transitions.find(
        (t) => t.action === action && t.from === instance.current_state
      );

      if (!transition) {
        throw new BadRequestException(
          `Invalid transition: ${action} from ${instance.current_state}`
        );
      }

      // 3. Execute guards
      await this.guardExecutor.checkGuards(transition.guards, {
        actorId,
        instance,
      });

      // 4. Update state
      const fromState = instance.current_state;
      instance.current_state = transition.to;

      // Check if reached final state
      const toStateConfig = dsl.states.find((s) => s.name === transition.to);
      if (toStateConfig.type === 'final') {
        instance.completed_at = new Date();
      }

      await manager.save(instance);

      // 5. Record history
      await manager.save(WorkflowHistory, {
        instance_id: instanceId,
        from_state: fromState,
        to_state: transition.to,
        action,
        actor_id: actorId,
        metadata: {},
      });

      // 6. Execute effects
      await this.effectExecutor.executeEffects(transition.effects, {
        instance,
        actorId,
        manager,
      });
    });
  }

  async getInstanceHistory(instanceId: number): Promise<WorkflowHistory[]> {
    return this.historyRepo.find({
      where: { instance_id: instanceId },
      relations: ['actor'],
      order: { transitioned_at: 'ASC' },
    });
  }

  async getCurrentState(entityType: string, entityId: number): Promise<string> {
    const instance = await this.instanceRepo.findOne({
      where: { entity_type: entityType, entity_id: entityId },
      order: { started_at: 'DESC' },
    });

    return instance?.current_state || null;
  }
}
```

### 5. Guard Executor

```typescript
// File: backend/src/modules/workflow-engine/services/guard-executor.service.ts
@Injectable()
export class GuardExecutorService {
  constructor(private abilityFactory: AbilityFactory) {}

  async checkGuards(guards: Guard[], context: any): Promise<void> {
    if (!guards || guards.length === 0) {
      return;
    }

    for (const guard of guards) {
      await this.checkGuard(guard, context);
    }
  }

  private async checkGuard(guard: Guard, context: any): Promise<void> {
    switch (guard.type) {
      case 'permission':
        await this.checkPermission(guard.permission, context);
        break;

      case 'validation':
        await this.checkValidation(guard.rules, context);
        break;

      case 'condition':
        await this.checkCondition(guard.condition, context);
        break;

      default:
        throw new BadRequestException(`Unknown guard type: ${guard.type}`);
    }
  }

  private async checkPermission(
    permission: string,
    context: any
  ): Promise<void> {
    const ability = await this.abilityFactory.createForUser({
      user_id: context.actorId,
    });
    const [action, subject] = permission.split('.');

    if (!ability.can(action, subject)) {
      throw new ForbiddenException(`Permission denied: ${permission}`);
    }
  }

  private async checkValidation(rules: string[], context: any): Promise<void> {
    // Implement validation rules
    // e.g., "hasAttachment", "hasRecipient"
  }

  private async checkCondition(condition: string, context: any): Promise<void> {
    // Evaluate condition expression
    // e.g., "entity.status === 'draft'"
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('WorkflowEngineService', () => {
  it('should create instance with initial state', async () => {
    const instance = await service.createInstance(
      'CORRESPONDENCE_ROUTING',
      'correspondence',
      1
    );

    expect(instance.current_state).toBe('DRAFT');
  });

  it('should execute valid transition', async () => {
    await service.executeTransition(instance.id, 'SUBMIT', userId);

    const updated = await instanceRepo.findOne(instance.id);
    expect(updated.current_state).toBe('SUBMITTED');
  });

  it('should reject invalid transition', async () => {
    await expect(
      service.executeTransition(instance.id, 'INVALID_ACTION', userId)
    ).rejects.toThrow('Invalid transition');
  });
});
```

---

## 📚 Related Documents

- [ADR-001: Unified Workflow Engine](../05-decisions/ADR-001-unified-workflow-engine.md)
- [Unified Workflow Requirements](../01-requirements/03.6-unified-workflow.md)

---

## 📦 Deliverables

- [ ] Workflow Entities (Definition, Instance, History)
- [ ] DSL Parser และ Validator
- [ ] WorkflowEngineService
- [ ] Guard Executor
- [ ] Effect Executor
- [ ] Example Workflow Definitions
- [ ] Unit Tests (90% coverage)
- [ ] Integration Tests
- [ ] Documentation

---

## 🚨 Risks & Mitigation

| Risk               | Impact   | Mitigation                              |
| ------------------ | -------- | --------------------------------------- |
| DSL parsing errors | High     | Comprehensive validation                |
| Guard failures     | Medium   | Clear error messages                    |
| State corruption   | Critical | Transaction-safe updates                |
| Performance issues | Medium   | Optimize DSL parsing, cache definitions |

---

## 📌 Notes

- DSL structure validated on save
- Workflow definitions versioned
- Guard checks before state changes
- History tracked for audit trail
- Effects executed after state update
