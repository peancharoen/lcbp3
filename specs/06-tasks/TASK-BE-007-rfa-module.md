# Task: RFA Module

**Status:** In Progress
**Priority:** P1 (High - Core Business Module)
**Estimated Effort:** 8-12 days
**Dependencies:** TASK-BE-001, TASK-BE-002, TASK-BE-003, TASK-BE-004, TASK-BE-006
**Owner:** Backend Team

---

## 📋 Overview

สร้าง RFA (Request for Approval) Module สำหรับจัดการเอกสารขออนุมัติด้วย Master-Revision Pattern พร้อม Approval Workflow

---

## 🎯 Objectives

- ✅ CRUD Operations (RFAs + Revisions + Items)
- ✅ Master-Revision Pattern
- ✅ RFA Items Management
- ✅ Approval Workflow Integration
- ✅ Response/Approve Actions
- ✅ Status Tracking

---

## 📝 Acceptance Criteria

1. **Basic Operations:**

   - ✅ Create RFA with auto-generated number
   - ✅ Add/Update/Delete RFA items
   - ✅ Create revision
   - ✅ Get RFA with all items and attachments

2. **Approval Workflow:**

   - ✅ Submit RFA → Start approval workflow
   - ✅ Review RFA (Approve/Reject/Revise)
   - ✅ Respond to RFA
   - ✅ Track approval status

3. **RFA Items:**
   - ✅ Add multiple items to RFA
   - ✅ Link items to drawings (optional)
   - ✅ Item-level approval tracking

---

## 🛠️ Implementation Steps

### 1. Entities

```typescript
// File: backend/src/modules/rfa/entities/rfa.entity.ts
@Entity('rfas')
export class Rfa extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  rfa_number: string;

  @Column({ length: 500 })
  subject: string;

  @Column()
  project_id: number;

  @Column()
  contractor_organization_id: number;

  @Column()
  consultant_organization_id: number;

  @Column()
  rfa_type_id: number;

  @Column({ nullable: true })
  discipline_id: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ nullable: true })
  approved_code_id: number; // Final approval result

  @Column()
  created_by_user_id: number;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relationships
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => RfaRevision, (rev) => rev.rfa)
  revisions: RfaRevision[];

  @OneToMany(() => RfaItem, (item) => item.rfa)
  items: RfaItem[];

  @ManyToOne(() => RfaApproveCode)
  @JoinColumn({ name: 'approved_code_id' })
  approvedCode: RfaApproveCode;
}
```

```typescript
// File: backend/src/modules/rfa/entities/rfa-revision.entity.ts
@Entity('rfa_revisions')
export class RfaRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  rfa_id: number;

  @Column({ default: 1 })
  revision_number: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ type: 'date', nullable: true })
  required_date: Date;

  @Column()
  created_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Rfa, (rfa) => rfa.revisions)
  @JoinColumn({ name: 'rfa_id' })
  rfa: Rfa;

  @ManyToMany(() => Attachment)
  @JoinTable({
    name: 'rfa_attachments',
    joinColumn: { name: 'rfa_revision_id' },
    inverseJoinColumn: { name: 'attachment_id' },
  })
  attachments: Attachment[];
}
```

```typescript
// File: backend/src/modules/rfa/entities/rfa-item.entity.ts
@Entity('rfa_items')
export class RfaItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  rfa_id: number;

  @Column({ length: 500 })
  item_description: string;

  @Column({ nullable: true })
  drawing_id: number;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  quantity: number;

  @Column({ length: 50, nullable: true })
  unit: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @ManyToOne(() => Rfa, (rfa) => rfa.items)
  @JoinColumn({ name: 'rfa_id' })
  rfa: Rfa;

  @ManyToOne(() => ShopDrawing)
  @JoinColumn({ name: 'drawing_id' })
  drawing: ShopDrawing;
}
```

### 2. Service

```typescript
// File: backend/src/modules/rfa/rfa.service.ts
@Injectable()
export class RfaService {
  constructor(
    @InjectRepository(Rfa)
    private rfaRepo: Repository<Rfa>,
    @InjectRepository(RfaRevision)
    private revisionRepo: Repository<RfaRevision>,
    @InjectRepository(RfaItem)
    private itemRepo: Repository<RfaItem>,
    private fileStorage: FileStorageService,
    private docNumbering: DocumentNumberingService,
    private workflowEngine: WorkflowEngineService,
    private dataSource: DataSource
  ) {}

  async create(dto: CreateRfaDto, userId: number): Promise<Rfa> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Generate RFA number
      const rfaNumber = await this.docNumbering.generateNextNumber({
        projectId: dto.project_id,
        organizationId: dto.contractor_organization_id,
        typeId: dto.rfa_type_id,
        disciplineId: dto.discipline_id,
      });

      // 2. Create RFA master
      const rfa = manager.create(Rfa, {
        rfa_number: rfaNumber,
        subject: dto.subject,
        project_id: dto.project_id,
        contractor_organization_id: dto.contractor_organization_id,
        consultant_organization_id: dto.consultant_organization_id,
        rfa_type_id: dto.rfa_type_id,
        discipline_id: dto.discipline_id,
        status: 'draft',
        created_by_user_id: userId,
      });
      await manager.save(rfa);

      // 3. Create initial revision
      const revision = manager.create(RfaRevision, {
        rfa_id: rfa.id,
        revision_number: 1,
        description: dto.description,
        details: dto.details,
        required_date: dto.required_date,
        created_by_user_id: userId,
      });
      await manager.save(revision);

      // 4. Create RFA items
      if (dto.items?.length > 0) {
        const items = dto.items.map((item) =>
          manager.create(RfaItem, {
            rfa_id: rfa.id,
            ...item,
          })
        );
        await manager.save(items);
      }

      // 5. Commit temp files
      if (dto.temp_file_ids?.length > 0) {
        const attachments = await this.fileStorage.commitFiles(
          dto.temp_file_ids,
          rfa.id,
          'rfa',
          manager
        );
        revision.attachments = attachments;
        await manager.save(revision);
      }

      // 6. Create workflow instance
      await this.workflowEngine.createInstance(
        'RFA_APPROVAL',
        'rfa',
        rfa.id,
        manager
      );

      return rfa;
    });
  }

  async submitForApproval(id: number, userId: number): Promise<void> {
    const rfa = await this.findOne(id);

    if (rfa.status !== 'draft') {
      throw new BadRequestException('Can only submit draft RFAs');
    }

    // Validate items exist
    if (!rfa.items || rfa.items.length === 0) {
      throw new BadRequestException('RFA must have at least one item');
    }

    // Execute workflow transition
    await this.workflowEngine.executeTransition(rfa.id, 'SUBMIT', userId);

    // Update status
    await this.rfaRepo.update(id, { status: 'submitted' });
  }

  async reviewRfa(
    id: number,
    action: 'approve' | 'reject' | 'revise',
    dto: ReviewRfaDto,
    userId: number
  ): Promise<void> {
    const rfa = await this.findOne(id);

    if (rfa.status !== 'submitted' && rfa.status !== 'under_review') {
      throw new BadRequestException('Invalid RFA status for review');
    }

    // Execute workflow transition
    const workflowAction = action.toUpperCase();
    await this.workflowEngine.executeTransition(rfa.id, workflowAction, userId);

    // Update RFA status and approval code
    const updates: any = {
      status:
        action === 'approve'
          ? 'approved'
          : action === 'reject'
          ? 'rejected'
          : 'revising',
    };

    if (action === 'approve' && dto.approve_code_id) {
      updates.approved_code_id = dto.approve_code_id;
    }

    await this.rfaRepo.update(id, updates);
  }

  async respondToRfa(
    id: number,
    dto: RespondRfaDto,
    userId: number
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const rfa = await this.findOne(id);

      if (rfa.status !== 'approved' && rfa.status !== 'rejected') {
        throw new BadRequestException('RFA must be reviewed first');
      }

      // Create response revision
      const latestRevision = await manager.findOne(RfaRevision, {
        where: { rfa_id: id },
        order: { revision_number: 'DESC' },
      });

      const responseRevision = manager.create(RfaRevision, {
        rfa_id: id,
        revision_number: (latestRevision?.revision_number || 0) + 1,
        description: dto.response_description,
        details: dto.response_details,
        created_by_user_id: userId,
      });

      await manager.save(responseRevision);

      // Commit response files
      if (dto.temp_file_ids?.length > 0) {
        const attachments = await this.fileStorage.commitFiles(
          dto.temp_file_ids,
          id,
          'rfa',
          manager
        );
        responseRevision.attachments = attachments;
        await manager.save(responseRevision);
      }

      // Update status
      await manager.update(Rfa, id, { status: 'responded' });

      // Execute workflow
      await this.workflowEngine.executeTransition(id, 'RESPOND', userId);
    });
  }

  async findAll(query: SearchRfaDto): Promise<PaginatedResult<Rfa>> {
    const queryBuilder = this.rfaRepo
      .createQueryBuilder('rfa')
      .leftJoinAndSelect('rfa.project', 'project')
      .leftJoinAndSelect('rfa.items', 'items')
      .leftJoinAndSelect('rfa.approvedCode', 'approvedCode')
      .where('rfa.deleted_at IS NULL');

    // Apply filters
    if (query.project_id) {
      queryBuilder.andWhere('rfa.project_id = :projectId', {
        projectId: query.project_id,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('rfa.status = :status', { status: query.status });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(rfa.subject LIKE :search OR rfa.rfa_number LIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await queryBuilder
      .orderBy('rfa.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number): Promise<Rfa> {
    const rfa = await this.rfaRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: [
        'revisions',
        'revisions.attachments',
        'items',
        'items.drawing',
        'project',
        'approvedCode',
      ],
      order: { revisions: { revision_number: 'DESC' } },
    });

    if (!rfa) {
      throw new NotFoundException(`RFA #${id} not found`);
    }

    return rfa;
  }
}
```

### 3. Controller

```typescript
// File: backend/src/modules/rfa/rfa.controller.ts
@Controller('rfas')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiTags('RFAs')
export class RfaController {
  constructor(private service: RfaService) {}

  @Post()
  @RequirePermission('rfa.create')
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Body() dto: CreateRfaDto,
    @CurrentUser() user: User
  ): Promise<Rfa> {
    return this.service.create(dto, user.user_id);
  }

  @Post(':id/submit')
  @RequirePermission('rfa.submit')
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User
  ) {
    return this.service.submitForApproval(id, user.user_id);
  }

  @Post(':id/review')
  @RequirePermission('rfa.review')
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewRfaDto,
    @CurrentUser() user: User
  ) {
    return this.service.reviewRfa(id, dto.action, dto, user.user_id);
  }

  @Post(':id/respond')
  @RequirePermission('rfa.respond')
  async respond(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondRfaDto,
    @CurrentUser() user: User
  ) {
    return this.service.respondToRfa(id, dto, user.user_id);
  }

  @Get()
  @RequirePermission('rfa.view')
  async findAll(@Query() query: SearchRfaDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermission('rfa.view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('RfaService', () => {
  it('should create RFA with items', async () => {
    const dto = {
      subject: 'Test RFA',
      project_id: 1,
      contractor_organization_id: 3,
      consultant_organization_id: 1,
      rfa_type_id: 1,
      items: [
        { item_description: 'Item 1', quantity: 10, unit: 'pcs' },
        { item_description: 'Item 2', quantity: 5, unit: 'm' },
      ],
    };

    const result = await service.create(dto, 1);

    expect(result.rfa_number).toMatch(/^TEAM-RFA-\d{4}-\d{4}$/);
    expect(result.items).toHaveLength(2);
  });

  it('should execute approval workflow', async () => {
    await service.submitForApproval(rfa.id, userId);
    await service.reviewRfa(
      rfa.id,
      'approve',
      { approve_code_id: 1 },
      reviewerId
    );

    const updated = await service.findOne(rfa.id);
    expect(updated.status).toBe('approved');
    expect(updated.approved_code_id).toBe(1);
  });
});
```

---

## 📚 Related Documents

- [Data Model - RFAs](../02-architecture/data-model.md#rfas)
- [Functional Requirements - RFA](../01-requirements/03.3-rfa.md)

---

## 📦 Deliverables

- [ ] Rfa, RfaRevision, RfaItem Entities
- [ ] RfaService (CRUD + Approval Workflow)
- [ ] RfaController
- [ ] DTOs (Create, Review, Respond, Search)
- [ ] Unit Tests (85% coverage)
- [ ] Integration Tests
- [ ] API Documentation

---

## 🚨 Risks & Mitigation

| Risk                       | Impact | Mitigation                     |
| -------------------------- | ------ | ------------------------------ |
| Complex approval workflow  | High   | Clear state machine definition |
| Item management complexity | Medium | Transaction-safe CRUD          |
| Response/revision tracking | Medium | Clear revision numbering       |

---

## 📌 Notes

- RFA Items required before submit
- Approval codes from master data table
- Support multi-level approval workflow
- Response creates new revision
- Link items to drawings (optional)
