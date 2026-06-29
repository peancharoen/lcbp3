# Data Model: RFA Approval System Refactor

**Date**: 2026-05-11  
**Based on**: research.md decisions, spec.md requirements

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  ReviewTeam     │────<│ ReviewTeamMember │>────│     User        │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ publicId (PK)   │     │ teamId (FK)      │     │ publicId (PK)   │
│ projectId (FK)  │     │ userId (FK)      │     │ ...             │
│ name            │     │ disciplineId(FK) │     └─────────────────┘
│ isActive        │     │ role             │
└────────┬────────┘     └──────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   ReviewTask    │>────│  RfaRevision     │<────│  RfaStatusCode  │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ publicId (PK)   │     │ id (PK)          │     │ id (PK)         │
│ teamId (FK)     │     │ correspondenceId │     │ statusCode      │
│ disciplineId    │     │ revisionNumber   │     └─────────────────┘
│ assignedToId    │     └──────────────────┘
│ status          │
│ dueDate         │
│ responseCodeId  │>────┐
│ comments        │     │
└─────────────────┘     │
                        ▼
              ┌─────────────────┐
              │  ResponseCode   │
              ├─────────────────┤
              │ id (PK)         │
              │ code            │
              │ subStatus       │
              │ category        │
              │ descriptionTh   │
              │ descriptionEn   │
              │ implications    │
              └────────┬────────┘
                       │ 1:N
                       ▼
              ┌─────────────────┐
              │ResponseCodeRule │
              ├─────────────────┤
              │ id (PK)         │
              │ projectId (FK)  │
              │ documentTypeId  │
              │ responseCodeId  │
              │ isEnabled       │
              │ requiresComments│
              │ triggersNotification│
              │ parentRuleId    │
              └─────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Delegation    │     │   ReminderRule   │     │ DistributionMatrix│
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ publicId (PK)   │     │ publicId (PK)    │     │ publicId (PK)   │
│ delegatorId     │     │ name             │     │ name            │
│ delegateeId     │     │ projectId        │     │ documentTypeId│
│ startDate       │     │ documentTypeId   │     │ responseCodeId│
│ endDate         │     │ triggerDays      │     │ conditions    │
│ scope           │     │ reminderType     │     │ isActive        │
│ isActive        │     │ recipients       │     └────────┬────────┘
└─────────────────┘     │ messageTemplate  │              │ 1:N
                        └──────────────────┘              ▼
                                               ┌─────────────────┐
                                               │DistributionRecipient│
                                               ├─────────────────┤
                                               │ id (PK)         │
                                               │ matrixId (FK)   │
                                               │ recipientType   │
                                               │ recipientId     │
                                               │ deliveryMethod  │
                                               └─────────────────┘
```

---

## Core Entities

### 1. ReviewTeam (ทีมตรวจสอบ)

```typescript
@Entity('review_teams')
class ReviewTeam {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;  // ADR-019: UUIDv7 string

  @Column()
  @Exclude()
  projectId: number;  // FK to projects

  @Column({ length: 100 })
  name: string;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column('simple-array', { nullable: true })
  defaultForRfaTypes?: string[];  // ['SDW', 'DDW', 'ADW']

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => ReviewTeamMember, member => member.team)
  members: ReviewTeamMember[];
}
```

**Key Fields**:
- `defaultForRfaTypes`: Auto-assign this team to specific RFA types
- `isActive`: Soft delete support

---

### 2. ReviewTeamMember (สมาชิกทีม)

```typescript
@Entity('review_team_members')
class ReviewTeamMember {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column()
  @Exclude()
  teamId: number;

  @Column()
  @Exclude()
  userId: number;

  @Column()
  @Exclude()
  disciplineId: number;  // FK to disciplines

  @Column({ length: 50, default: 'REVIEWER' })
  role: 'REVIEWER' | 'LEAD' | 'MANAGER';

  @Column({ default: 0 })
  priorityOrder: number;  // For sequential assignment fallback

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => ReviewTeam, team => team.members)
  @JoinColumn({ name: 'teamId' })
  team: ReviewTeam;

  @ManyToOne(() => User, user => user.reviewTeamMemberships)
  @JoinColumn({ name: 'userId' })
  user: User;
}
```

---

### 3. ReviewTask (งานตรวจสอบ)

```typescript
export enum ReviewTaskStatus {
  PENDING = 'PENDING',      // รอดำเนินการ
  IN_PROGRESS = 'IN_PROGRESS', // กำลังตรวจสอบ
  COMPLETED = 'COMPLETED',  // เสร็จสิ้น (มีผลลัพธ์)
  DELEGATED = 'DELEGATED',  // ถูกมอบหมายให้ผู้อื่น
  EXPIRED = 'EXPIRED',      // เกินกำหนด
  CANCELLED = 'CANCELLED',  // ยกเลิก
}

@Entity('review_tasks')
class ReviewTask {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column()
  @Exclude()
  rfaRevisionId: number;  // FK to rfa_revisions

  @Column()
  @Exclude()
  teamId: number;

  @Column()
  @Exclude()
  disciplineId: number;

  @Column({ nullable: true })
  @Exclude()
  assignedToUserId?: number;  // Null = auto-assign by discipline

  @Column({ type: 'enum', enum: ReviewTaskStatus, default: ReviewTaskStatus.PENDING })
  status: ReviewTaskStatus;

  @Column({ type: 'date', nullable: true })
  dueDate?: Date;

  @Column({ nullable: true })
  @Exclude()
  responseCodeId?: number;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'json', nullable: true })
  attachments?: string[];  // Array of attachment publicIds

  @Column({ nullable: true })
  @Exclude()
  delegatedFromUserId?: number;  // For delegation tracking

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ReviewTeam, team => team.tasks)
  team: ReviewTeam;

  @ManyToOne(() => ResponseCode)
  @JoinColumn({ name: 'responseCodeId' })
  responseCode?: ResponseCode;
}
```

---

### 4. ResponseCode (รหัสตอบกลับมาตรฐาน)

```typescript
export enum ResponseCodeCategory {
  ENGINEERING = 'ENGINEERING',      // Shop Drawing / MS
  MATERIAL = 'MATERIAL',            // Material / Procurement
  CONTRACT = 'CONTRACT',            // Contract / Cost / BOQ
  TESTING = 'TESTING',              // Testing / Handover / QA
  ESG = 'ESG',                      // Environment / Social
}

@Entity('response_codes')
class ResponseCode {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column({ length: 10 })
  code: string;  // '1A', '1B', '1C', '1D', '1E', '1F', '1G', '2', '3', '4'

  @Column({ length: 10, nullable: true })
  subStatus?: string;  // '1A', '1B', etc.

  @Column({ type: 'enum', enum: ResponseCodeCategory })
  category: ResponseCodeCategory;

  @Column({ type: 'text' })
  descriptionTh: string;

  @Column({ type: 'text' })
  descriptionEn: string;

  @Column({ type: 'json', nullable: true })
  implications?: {
    affectsSchedule?: boolean;
    affectsCost?: boolean;
    requiresContractReview?: boolean;
    requiresEiaAmendment?: boolean;
  };

  @Column({ type: 'simple-array', nullable: true })
  notifyRoles?: string[];  // ['CONTRACT_MANAGER', 'QS_MANAGER', 'EIA_OFFICER']

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystem: boolean;  // System default, cannot delete

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => ResponseCodeRule, rule => rule.responseCode)
  rules: ResponseCodeRule[];
}
```

---

### 5. ResponseCodeRule (กฎการใช้รหัส)

```typescript
@Entity('response_code_rules')
class ResponseCodeRule {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column({ nullable: true })
  @Exclude()
  projectId?: number;  // NULL = global default

  @Column()
  @Exclude()
  documentTypeId: number;

  @Column()
  @Exclude()
  responseCodeId: number;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: false })
  requiresComments: boolean;

  @Column({ default: false })
  triggersNotification: boolean;

  @Column({ nullable: true })
  @Exclude()
  parentRuleId?: number;  // Inheritance tracking

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ResponseCode, code => code.rules)
  @JoinColumn({ name: 'responseCodeId' })
  responseCode: ResponseCode;
}
```

---

### 6. Delegation (การมอบหมาย)

```typescript
export enum DelegationScope {
  ALL = 'ALL',
  RFA_ONLY = 'RFA_ONLY',
  CORRESPONDENCE_ONLY = 'CORRESPONDENCE_ONLY',
  SPECIFIC_TYPES = 'SPECIFIC_TYPES',
}

@Entity('delegations')
class Delegation {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column()
  @Exclude()
  delegatorId: number;  // ผู้มอบหมาย

  @Column()
  @Exclude()
  delegateeId: number;  // ผู้รับมอบหมาย

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'enum', enum: DelegationScope, default: DelegationScope.ALL })
  scope: DelegationScope;

  @Column('simple-array', { nullable: true })
  documentTypes?: string[];  // ['SDW', 'DDW'] when scope = SPECIFIC_TYPES

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegatorId' })
  delegator: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegateeId' })
  delegatee: User;
}
```

---

### 7. ReminderRule (กฎการแจ้งเตือน)

```typescript
export enum ReminderType {
  DUE_SOON = 'DUE_SOON',        // X days before due
  ON_DUE = 'ON_DUE',            // On due date
  OVERDUE = 'OVERDUE',          // After due date (repeating)
  ESCALATION_L1 = 'ESCALATION_L1',  // Level 1 escalation
  ESCALATION_L2 = 'ESCALATION_L2',  // Level 2 escalation
}

@Entity('reminder_rules')
class ReminderRule {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true })
  @Exclude()
  projectId?: number;  // NULL = global

  @Column({ nullable: true })
  @Exclude()
  documentTypeId?: number;  // NULL = all types

  @Column({ default: 2 })
  triggerDaysBeforeDue: number;  // Days before due for DUE_SOON

  @Column({ default: 1 })
  escalationDaysAfterDue: number;  // Days after due for L1 escalation

  @Column({ type: 'enum', enum: ReminderType })
  reminderType: ReminderType;

  @Column({ type: 'simple-array' })
  recipients: ('ASSIGNEE' | 'MANAGER' | 'PROJECT_MANAGER')[];

  @Column({ type: 'text' })
  messageTemplateTh: string;

  @Column({ type: 'text' })
  messageTemplateEn: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

### 8. DistributionMatrix (ตารางกระจายเอกสาร)

```typescript
@Entity('distribution_matrices')
class DistributionMatrix {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column({ length: 100 })
  name: string;

  @Column()
  @Exclude()
  documentTypeId: number;

  @Column({ nullable: true })
  @Exclude()
  responseCodeId?: number;  // NULL = all codes

  @Column({ type: 'json', nullable: true })
  conditions?: {
    codes?: string[];  // ['1A', '1B', '2']
    excludeCodes?: string[];  // ['3', '4']
    projectPhase?: string;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => DistributionRecipient, recipient => recipient.matrix)
  recipients: DistributionRecipient[];
}
```

---

### 9. DistributionRecipient (ผู้รับเอกสาร)

```typescript
export enum RecipientType {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
  TEAM = 'TEAM',
  ROLE = 'ROLE',  // e.g., 'ALL_QS', 'ALL_SITE_ENG'
}

export enum DeliveryMethod {
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
  BOTH = 'BOTH',
}

@Entity('distribution_recipients')
class DistributionRecipient {
  @PrimaryGeneratedColumn('increment')
  @Exclude()
  id: number;

  @Column()
  @Exclude()
  matrixId: number;

  @Column({ type: 'enum', enum: RecipientType })
  recipientType: RecipientType;

  @Column({ type: 'uuid' })  // Can be userId, orgId, teamId
  recipientPublicId: string;

  @Column({ type: 'enum', enum: DeliveryMethod, default: DeliveryMethod.BOTH })
  deliveryMethod: DeliveryMethod;

  @Column({ nullable: true })
  sequence?: number;  // For ordered delivery

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## Database Indexes

```sql
-- Review Tasks - Core query patterns
CREATE INDEX idx_review_tasks_rfa_revision ON review_tasks(rfaRevisionId);
CREATE INDEX idx_review_tasks_status ON review_tasks(status);
CREATE INDEX idx_review_tasks_assigned ON review_tasks(assignedToUserId, status);

-- Response Code Rules - Lookup by document type
CREATE INDEX idx_response_rules_lookup ON response_code_rules(
  projectId, 
  documentTypeId, 
  isEnabled
);

-- Delegations - Active lookup
CREATE INDEX idx_delegations_active ON delegations(
  delegatorId, 
  isActive, 
  startDate, 
  endDate
);

-- Distribution - Matrix lookup
CREATE INDEX idx_distribution_lookup ON distribution_matrices(
  documentTypeId, 
  responseCodeId, 
  isActive
);
```

---

## Validation Rules

| Entity | Rule | Implementation |
|--------|------|----------------|
| ReviewTask | Cannot assign completed task | Check status before update |
| Delegation | No circular chains | BFS/DFS validation on create |
| Delegation | Max 3 levels deep | Enforce in service layer |
| ResponseCodeRule | Only one enabled per doc type + code per project | Unique constraint |
| ReviewTeam | At least one member with LEAD role | Validate on activation |

---

## Next Steps

1. Generate SQL schema file (follows ADR-009: no TypeORM migrations)
2. Create TypeORM entities in `backend/src/modules/`
3. Create API contracts in `contracts/`
