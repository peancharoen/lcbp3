# ADR-001: Unified Workflow Engine

**Status:** Accepted
**Date:** 2026-02-24
**Decision Makers:** Development Team, System Architect
**Related Documents:**

- [Software Architecture](../02-Architecture/02-02-software-architecture.md)
- [Unified Workflow Requirements](../01-Requirements/01-03-modules/01-03-06-unified-workflow.md)

---

## Context and Problem Statement

LCBP3-DMS ต้องจัดการเอกสารหลายประเภท (Correspondences, RFAs, Circulations) โดยแต่ละประเภทมี Workflow การเดินเอกสารที่แตกต่างกัน:

- **Correspondence Routing:** ส่งเอกสารระหว่างองค์กร มีการ Forward, Reply
- **RFA Approval Workflow:** ส่งขออนุมัติ มีขั้นตอน Review → Approve → Respond
- **Circulation Workflow:** เวียนเอกสารภายในองค์กร มีการ Assign ผู้รับเพื่อพิจารณา

### Key Problems

1. **Code Duplication:** หากสร้างตาราง Routing แยกกันสำหรับแต่ละประเภทเอกสาร จะมี Logic ซ้ำซ้อน
2. **Complexity:** การ Maintain หลาย Workflow Systems ทำให้ซับซ้อน
3. **Inconsistency:** State Management และ History Tracking อาจไม่สอดคล้องกัน
4. **Scalability:** เมื่อเพิ่มประเภทเอกสารใหม่ ต้องสร้าง Workflow System ใหม่
5. **Versioning:** การแก้ไข Workflow กระทบเอกสารที่กำลังดำเนินการอยู่

---

## Decision Drivers

- **DRY Principle:** Don't Repeat Yourself - ลดการเขียน Code ซ้ำ
- **Maintainability:** ง่ายต่อการ Maintain และ Debug
- **Flexibility:** รองรับการเปลี่ยนแปลง Workflow ในอนาคต
- **Traceability:** ติดตามประวัติการเปลี่ยนสถานะได้ชัดเจน
- **Performance:** ประมวลผล Workflow ได้เร็วและมีประสิทธิภาพ

---

## Considered Options

### Option 1: Hard-coded Workflow per Document Type

**แนวทาง:** สร้างตาราง `correspondence_routings`, `rfa_approvals`, `circulation_routings` แยกกัน

**Pros:**

- ✅ เข้าใจง่าย straightforward
- ✅ Query performance ดี (table-specific indexes)
- ✅ Schema ชัดเจนสำหรับแต่ละ type

**Cons:**

- ❌ Code duplication มาก
- ❌ ยากต่อการเพิ่ม Document Type ใหม่
- ❌ Inconsistent state management
- ❌ ไม่มี Workflow versioning mechanism
- ❌ ยากต่อการ reuse common workflows

### Option 2: Generic Workflow Engine with Hard-coded State Machines

**แนวทาง:** สร้าง Workflow Engine แต่ Hard-code State Machine ไว้ใน Code

**Pros:**

- ✅ Centralized workflow logic
- ✅ Reusable workflow components
- ✅ Better maintainability

**Cons:**

- ❌ ต้อง Deploy ใหม่ทุกครั้งที่แก้ Workflow
- ❌ ไม่ยืดหยุ่นสำหรับ Business Users
- ❌ Versioning ยังซับซ้อน

### Option 3: **DSL-Based Unified Workflow Engine** ⭐ (Selected)

**แนวทาง:** สร้าง Workflow Engine ที่ใช้ JSON-based DSL (Domain Specific Language) เพื่อ Define Workflows

**Pros:**

- ✅ **Single Source of Truth:** Workflow logic อยู่ใน Database
- ✅ **Versioning Support:** เก็บ Workflow Definition versions ได้
- ✅ **Runtime Flexibility:** แก้ Workflow ได้โดยไม่ต้อง Deploy
- ✅ **Reusability:** Workflow templates สามารถใช้ซ้ำได้
- ✅ **Consistency:** State management เป็นมาตรฐานเดียวกัน
- ✅ **Audit Trail:** ประวัติครบถ้วนใน `workflow_histories`
- ✅ **Scalability:** เพิ่ม Document Type ใหม่ได้ง่าย

**Cons:**

- ❌ Initial development complexity สูง
- ❌ ต้องเขียน DSL Parser และ Validator
- ❌ Performance overhead เล็กน้อย (parse JSON)
- ❌ Learning curve สำหรับทีม

---

## Decision Outcome

**Chosen Option:** Option 3 - DSL-Based Unified Workflow Engine

### Rationale

เลือก Unified Workflow Engine เนื่องจาก:

1. **Long-term Maintainability:** แม้จะมี complexity ในการพัฒนา แต่ในระยะยาวจะลดภาระการ Maintain
2. **Business Flexibility:** Business Users สามารถปรับ Workflow ได้ (ผ่าน Admin UI ในอนาคต)
3. **Consistency:** สถานะและประวัติเป็นมาตรฐานเดียวกันทุก Document Type
4. **Scalability:** เตรียมพร้อมสำหรับ Document Types ใหม่ๆ ในอนาคต
5. **Versioning:** รองรับการแก้ไข Workflow โดยไม่กระทบ In-progress documents

---

## Implementation Details

### Database Schema

```sql
-- Workflow Definitions (Templates)
CREATE TABLE workflow_definitions (
  id VARCHAR(36) PRIMARY KEY, -- UUID
  workflow_code VARCHAR(50) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  description TEXT NULL,
  dsl JSON NOT NULL,       -- Raw DSL from user
  compiled JSON NOT NULL,  -- Validated and optimized for Runtime
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (workflow_code, version)
);

-- Workflow Instances (Running Workflows)
CREATE TABLE workflow_instances (
  id VARCHAR(36) PRIMARY KEY, -- UUID
  definition_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- e.g. "correspondence", "rfa"
  entity_id VARCHAR(50) NOT NULL,
  current_state VARCHAR(50) NOT NULL,
  status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED') DEFAULT 'ACTIVE',
  context JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (definition_id) REFERENCES workflow_definitions(id)
);

-- Workflow History (Audit Trail)
CREATE TABLE workflow_histories (
  id VARCHAR(36) PRIMARY KEY, -- UUID
  instance_id VARCHAR(36) NOT NULL,
  from_state VARCHAR(50) NOT NULL,
  to_state VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  action_by_user_id INT NULL,
  comment TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE
);
```

### DSL Example

```json
{
  "workflow": "CORRESPONDENCE_ROUTING",
  "version": 1,
  "description": "Standard correspondence routing",
  "states": [
    {
      "name": "DRAFT",
      "initial": true,
      "on": {
        "SUBMIT": {
          "to": "SUBMITTED",
          "require": {
            "role": ["Admin"],
            "user": "123"
          },
          "condition": "context.requiresLegal > 0",
          "events": [
            {
              "type": "notify",
              "target": "originator",
              "template": "correspondence_submitted"
            }
          ]
        }
      }
    },
    {
      "name": "SUBMITTED",
      "on": {
        "RECEIVE": {
          "to": "RECEIVED"
        },
        "RETURN": {
          "to": "DRAFT"
        }
      }
    },
    {
      "name": "RECEIVED",
      "on": {
        "CLOSE": {
          "to": "CLOSED"
        }
      }
    },
    {
      "name": "CLOSED",
      "terminal": true
    }
  ]
}
```

### NestJS Module Structure

```typescript
// workflow-engine.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowHistory,
    ]),
    UserModule,
  ],
  controllers: [WorkflowEngineController],
  providers: [
    WorkflowEngineService,
    WorkflowDslService,
    WorkflowEventService,
  ],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}

// workflow-engine.service.ts
@Injectable()
export class WorkflowEngineService {
  async createInstance(
    workflowCode: string,
    entityType: string,
    entityId: string,
    initialContext: Record<string, unknown> = {}
  ): Promise<WorkflowInstance> {
    const definition = await this.workflowDefRepo.findOne({
      where: { workflow_code: workflowCode, is_active: true },
      order: { version: 'DESC' },
    });

    // Initial state directly from compiled DSL
    const initialState = definition.compiled.initialState;

    return this.instanceRepo.save({
      definition_id: definition.id,
      entityType,
      entityId,
      currentState: initialState,
      status: WorkflowStatus.ACTIVE,
      context: initialContext,
    });
  }

  async processTransition(
    instanceId: string,
    action: string,
    userId: number,
    comment?: string,
    payload: Record<string, unknown> = {}
  ) {
    // Evaluation via WorkflowDslService
    const evaluation = this.dslService.evaluate(
      compiled,
      instance.currentState,
      action,
      context
    );

    // Update state to target State
    instance.currentState = evaluation.nextState;

    if (compiled.states[evaluation.nextState].terminal) {
      instance.status = WorkflowStatus.COMPLETED;
    }

    // Process background events asynchronously
    if (evaluation.events && evaluation.events.length > 0) {
      this.eventService.dispatchEvents(instance.id, evaluation.events, context);
    }
  }
}
```

---

## Consequences

### Positive

1. ✅ **Unified State Management:** สถานะทุก Document Type จัดการโดย Engine เดียว
2. ✅ **No Code Changes for Workflow Updates:** แก้ Workflow ผ่าน JSON DSL
3. ✅ **Complete Audit Trail:** ประวัติครบถ้วนใน `workflow_histories`
4. ✅ **Versioning Support:** In-progress documents ใช้ Workflow Version เดิม
5. ✅ **Reusable Templates:** สามารถ Clone Workflow Template ได้
6. ✅ **Future-proof:** พร้อมสำหรับ Document Types ใหม่

### Negative

1. ❌ **Initial Complexity:** ต้องสร้าง DSL Parser, Validator, Executor
2. ❌ **Learning Curve:** ทีมต้องเรียนรู้ DSL Structure
3. ❌ **Performance:** เพิ่ม overhead เล็กน้อยจากการ parse JSON
4. ❌ **Debugging:** ยากกว่า Hard-coded logic เล็กน้อย
5. ❌ **Testing:** ต้อง Test ทั้ง Engine และ Workflow Definitions

### Mitigation Strategies

- **Complexity:** สร้าง UI Builder สำหรับ Workflow Design ในอนาคต
- **Learning Curve:** เขียน Documentation และ Examples ที่ชัดเจน
- **Performance:** ใช้ Redis Cache สำหรับ Workflow Definitions
- **Debugging:** สร้าง Workflow Visualization Tool
- **Testing:** เขียน Comprehensive Unit Tests สำหรับ Engine

---

## Compliance

เป็นไปตาม:

- [Backend Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md#workflow-engine-integration) - Unified Workflow Engine
- [Unified Workflow Requirements](../01-Requirements/01-03-modules/01-03-06-unified-workflow.md) - Unified Workflow Specification

---

## Notes

- Workflow DSL จะถูก Validate ด้วย JSON Schema ก่อน Save
- Admin UI สำหรับจัดการ Workflow จะพัฒนาใน Phase 2
- ต้องมี Migration Tool สำหรับ Workflow Definition Changes
- พิจารณาใช้ BPMN 2.0 Notation ในอนาคต (ถ้าต้องการ Visual Workflow Designer)

---

## Related ADRs

- [ADR-002: Document Numbering Strategy](./ADR-002-document-numbering-strategy.md) - ใช้ Workflow Engine trigger Document Number Generation
- [RBAC Matrix](../01-Requirements/01-02-business-rules/01-02-01-rbac-matrix.md) - Permission Guards ใน Workflow Transitions

---

## References

- [NestJS State Machine Example](https://docs.nestjs.com/techniques/queues)
- [Workflow Patterns](http://www.workflowpatterns.com/)
- [JSON Schema Specification](https://json-schema.org/)
