# Task BE-DB-01: Database Schema Strategy Implementation

**Phase:** Database Standardization & Optimization
**ADR Compliance:** ADR-004 (Database Schema Design), ADR-009 (Migration Strategy), ADR-019 (UUID Strategy)
**Priority:** 🟡 Important - Data Integrity & Performance

> **Context:** การ implement Selective Normalization Patterns ตาม ADR-004 เพื่อให้ database schema สอดคล้องกันและมีประสิทธิภาพ

---

## 📋 Implementation Tasks

### **DB-1.1: Base Entity Pattern Implementation**
- [ ] **Create Base Entity Classes:**
  - File: `backend/src/common/entities/base.entity.ts`
  - Features: UUID, timestamps, soft delete, audit fields
  - Inheritance: All entities extend from base
- [ ] **Create UuidBaseEntity (ADR-019):**
  - File: `backend/src/common/entities/uuid-base.entity.ts`
  - Properties: `id` (INT PK), `uuid` (UUID public), `createdAt`, `updatedAt`
  - Decorators: `@Exclude()` for internal ID, `@Expose()` for UUID
- [ ] **Update All Entity Classes:**
  - Directory: `backend/src/modules/*/entities/`
  - Extend from base entities
  - Add proper decorators and relationships
  - Ensure UUID handling compliance

### **DB-1.2: Audit Trail Implementation**
- [ ] **Create Audit Log Entity:**
  - File: `backend/src/common/entities/audit-log.entity.ts`
  - Table: `audit_logs`
  - Fields: `tableName`, `recordId`, `action`, `oldValues`, `newValues`, `userId`
  - Indexes: Performance optimization for queries
- [ ] **Create Audit Trail Service:**
  - File: `backend/src/common/services/audit-trail.service.ts`
  - Methods: `logCreate()`, `logUpdate()`, `logDelete()`, `logSoftDelete()`
  - Features: Automatic change detection, JSON diff, user tracking
- [ ] **Implement Audit Interceptor:**
  - File: `backend/src/common/interceptors/audit.interceptor.ts`
  - Trigger: Before/After database operations
  - Scope: All entity operations (CRUD)
  - Performance: Async logging to avoid blocking

### **DB-1.3: Workflow State Management**
- [ ] **Create Workflow State Entities:**
  - File: `backend/src/modules/workflow/entities/`
  - Entities: `WorkflowState`, `WorkflowInstance`, `WorkflowHistory`
  - Relationships: State machine definitions and instances
- [ ] **Implement State Transition Logic:**
  - File: `backend/src/modules/workflow/services/workflow-state.service.ts`
  - Methods: `validateTransition()`, `executeTransition()`, `getCurrentState()`
  - Features: Business rule validation, history tracking
- [ ] **Create Workflow History Tables:**
  - Tables: `workflow_histories`, `correspondence_histories`, `rfa_histories`
  - Purpose: Track all state changes with context
  - Features: JSON snapshots, user attribution, timestamps

### **DB-1.4: Schema Optimization & Indexing**
- [ ] **Analyze Current Query Patterns:**
  - Tools: MySQL slow query log, EXPLAIN plans
  - Focus: Correspondence list, RFA workflows, user permissions
  - Document: Current performance bottlenecks
- [ ] **Implement Strategic Indexes:**
  - Foreign key indexes: All FK columns indexed
  - Composite indexes: Common query patterns
  - Partial indexes: Active records only (WHERE deleted_at IS NULL)
- [ ] **Optimize Table Structures:**
  - Review: Data types, column sizes, NULL constraints
  - Normalize: Where beneficial for integrity
  - Denormalize: Where beneficial for performance

### **DB-1.5: Migration & Evolution Strategy**
- [ ] **Create Migration Scripts:**
  - Directory: `backend/src/database/migrations/`
  - Format: SQL scripts (following ADR-009)
  - Features: Rollback capability, dependency tracking
- [ ] **Implement Schema Validation:**
  - File: `backend/src/common/validators/schema.validator.ts`
  - Checks: Naming conventions, required fields, relationships
  - Automation: Pre-commit hooks, CI validation
- [ ] **Create Database Documentation:**
  - Auto-generation: From TypeORM entities
  - Format: Markdown with ER diagrams
  - Include: Field descriptions, relationships, indexes

---

## 🔧 Technical Implementation Details

### Base Entity Implementation

```typescript
// File: backend/src/common/entities/base.entity.ts
import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Column } from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

export abstract class BaseEntity extends UuidBaseEntity {
  @CreateDateColumn({ 
    type: 'timestamp',
    name: 'created_at',
    comment: 'Record creation time'
  })
  createdAt: Date;

  @UpdateDateColumn({ 
    type: 'timestamp',
    name: 'updated_at',
    comment: 'Last update time'
  })
  updatedAt: Date;

  @DeleteDateColumn({ 
    type: 'datetime',
    name: 'deleted_at',
    nullable: true,
    comment: 'Soft delete timestamp'
  })
  deletedAt?: Date;

  @Column({ 
    type: 'int',
    name: 'created_by',
    nullable: true,
    comment: 'User who created record'
  })
  createdBy?: number;

  @Column({ 
    type: 'int',
    name: 'updated_by',
    nullable: true,
    comment: 'User who last updated record'
  })
  updatedBy?: number;
}
```

### UuidBaseEntity (ADR-019)

```typescript
// File: backend/src/common/entities/uuid-base.entity.ts
import { PrimaryGeneratedColumn, Column, Exclude, Expose } from 'typeorm';

export abstract class UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id: number;

  @Column({ 
    type: 'uuid',
    unique: true,
    name: 'uuid',
    comment: 'Public UUID identifier (ADR-019)'
  })
  @Expose({ name: 'id' }) // Expose UUID as 'id' in API
  uuid: string;
}
```

### Audit Trail Service

```typescript
// File: backend/src/common/services/audit-trail.service.ts
@Injectable()
export class AuditTrailService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>
  ) {}

  async logCreate(entity: BaseEntity, userId: number): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      tableName: entity.constructor.name,
      recordId: entity.id,
      recordUuid: entity.uuid,
      action: 'CREATE',
      newValues: entity,
      userId
    });
    await this.auditLogRepo.save(auditLog);
  }

  async logUpdate(
    entity: BaseEntity, 
    oldValues: any, 
    newValues: any, 
    userId: number
  ): Promise<void> {
    const changedFields = this.getChangedFields(oldValues, newValues);
    
    const auditLog = this.auditLogRepo.create({
      tableName: entity.constructor.name,
      recordId: entity.id,
      recordUuid: entity.uuid,
      action: 'UPDATE',
      oldValues,
      newValues,
      changedFields,
      userId
    });
    await this.auditLogRepo.save(auditLog);
  }

  private getChangedFields(old: any, new: any): string[] {
    const changes: string[] = [];
    for (const key in new) {
      if (old[key] !== new[key]) {
        changes.push(key);
      }
    }
    return changes;
  }
}
```

### Audit Interceptor

```typescript
// File: backend/src/common/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditTrailService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    
    return next.handle().pipe(
      tap(async (result) => {
        // Log successful operations
        if (result && typeof result === 'object') {
          await this.auditService.logCreate(result, userId);
        }
      }),
      catchError(async (error) => {
        // Log failed operations
        console.error('Operation failed:', error);
        throw error;
      })
    );
  }
}
```

### Workflow State Management

```typescript
// File: backend/src/modules/workflow/entities/workflow-instance.entity.ts
@Entity('workflow_instances')
export class WorkflowInstance extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  workflowCode: string;

  @Column({ type: 'varchar', length: 50 })
  entityType: string; // 'correspondence', 'rfa', etc.

  @Column({ type: 'int' })
  entityId: number;

  @Column({ type: 'varchar', length: 50 })
  currentState: string;

  @Column({ 
    type: 'enum', 
    enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE'
  })
  status: string;

  @Column({ type: 'json', nullable: true })
  context: any; // Workflow-specific context

  // Relationships
  @ManyToOne(() => WorkflowState)
  @JoinColumn({ 
    name: 'workflow_code', 
    referencedColumnName: 'workflow_code',
    referencedColumnName: 'state_name'
  })
  currentStateDefinition: WorkflowState;

  @OneToMany(() => WorkflowHistory, history => history.instance)
  histories: WorkflowHistory[];
}
```

### Schema Migration Example

```sql
-- File: backend/src/database/migrations/001_add_audit_trail.sql

-- Create audit log table
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  record_uuid UUID NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE') NOT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  changed_fields JSON NULL,
  user_id INT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_audit_table_record (table_name, record_id),
  INDEX idx_audit_user (user_id, created_at),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_record_uuid (record_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Audit trail for all data changes';

-- Add base columns to existing tables (example)
ALTER TABLE correspondences 
ADD COLUMN created_by INT NULL COMMENT 'User who created record',
ADD COLUMN updated_by INT NULL COMMENT 'User who last updated record',
ADD INDEX idx_correspondences_created_by (created_by),
ADD INDEX idx_correspondences_updated_by (updated_by);
```

---

## 📊 Success Criteria

### Functional Requirements
- [ ] All entities extend from base classes
- [ ] Audit trail captures all data changes
- [ ] Workflow state management implemented
- [ ] Database performance optimized
- [ ] Migration strategy in place

### Non-Functional Requirements
- [ ] Query response times < 200ms (p90)
- [ ] Audit logging doesn't impact performance
- [ ] Schema validation automated
- [ ] Documentation auto-generated
- [ ] Zero data loss during migrations

### Compliance Requirements
- [ ] ADR-004 patterns followed consistently
- [ ] ADR-009 migration strategy implemented
- [ ] ADR-019 UUID strategy enforced
- [ ] Audit trail meets compliance requirements

---

## 🚀 Deployment & Rollout

### Phase 1: Base Pattern Implementation (Week 1)
- Create base entity classes
- Update core entities (users, organizations, projects)
- Implement audit trail foundation

### Phase 2: Workflow & Audit Implementation (Week 2-3)
- Implement workflow state management
- Add audit logging to all modules
- Create migration scripts

### Phase 3: Optimization & Documentation (Week 4)
- Performance optimization and indexing
- Schema validation automation
- Documentation generation

---

## 📋 Dependencies & Prerequisites

### Must Have
- ✅ ADR-004 Approved
- ✅ ADR-009 Migration Strategy
- ✅ ADR-019 UUID Strategy
- ✅ TypeORM configuration
- ✅ Database backup strategy

### Nice to Have
- Database performance monitoring
- Automated schema testing
- Visual ER diagram generation

---

## 🔄 Review & Acceptance

### Code Review Checklist
- [ ] All entities follow base pattern
- [ ] Audit logging comprehensive
- [ ] Workflow state correct
- [ ] Indexes optimized
- [ ] Migration scripts safe
- [ ] Documentation complete

### Acceptance Criteria
- [ ] All entities extend base classes
- [ ] Audit trail captures 100% of changes
- [ ] Performance benchmarks met
- [ ] Migration scripts tested
- [ ] Schema validation passes
- [ ] Documentation generated

---

**Owner:** Backend Team Lead + DBA  
**Estimated Effort:** 4 weeks (1-2 developers)  
**Risk Level:** High (Database schema changes)  
**Rollback Plan:** Full database backups, migration rollback scripts
