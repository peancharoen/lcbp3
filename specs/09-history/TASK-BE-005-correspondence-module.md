# Task: Correspondence Module

**Status:** Not Started
**Priority:** P1 (High - Core Business Module)
**Estimated Effort:** 7-10 days
**Dependencies:** TASK-BE-001, TASK-BE-002, TASK-BE-003, TASK-BE-004
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Correspondence Module สำหรับจัดการเอกสารโต้ตอบด้วย Master-Revision Pattern พร้อม Workflow Integration

---

## 🎯 Objectives

- ✅ CRUD Operations (Correspondences + Revisions)
- ✅ Master-Revision Pattern Implementation
- ✅ Attachment Management
- ✅ Workflow Integration (Routing)
- ✅ Document Number Generation
- ✅ Search & Filter

---

## 📝 Acceptance Criteria

1. **Basic Operations:**

   - ✅ Create correspondence (auto-generate number)
   - ✅ Create revision
   - ✅ Update correspondence/revision
   - ✅ Soft delete correspondence
   - ✅ Get correspondence with latest revision
   - ✅ Get all revisions history

2. **Attachments:**

   - ✅ Upload via two-phase storage
   - ✅ Link attachments to revision
   - ✅ Download attachments
   - ✅ Delete attachments

3. **Workflow:**

   - ✅ Submit correspondence → Create workflow instance
   - ✅ Execute workflow transitions
   - ✅ Track workflow status

4. **Search & Filter:**
   - ✅ Search by title, number, project
   - ✅ Filter by status, type, date range
   - ✅ Pagination support

---

## 🛠️ Implementation Steps

### 1. Entities

```typescript
// File: backend/src/modules/correspondence/entities/correspondence.entity.ts
@Entity('correspondences')
export class Correspondence extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  correspondence_number: string;

  @Column({ length: 500 })
  title: string;

  @Column()
  project_id: number;

  @Column()
  originator_organization_id: number;

  @Column()
  recipient_organization_id: number;

  @Column()
  correspondence_type_id: number;

  @Column({ nullable: true })
  discipline_id: number;

  @Column({ default: 'draft' })
  status: string;

  @Column()
  created_by_user_id: number;

  @DeleteDateColumn()
  deleted_at: Date;

  // Relationships
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'originator_organization_id' })
  originatorOrganization: Organization;

  @OneToMany(() => CorrespondenceRevision, (rev) => rev.correspondence)
  revisions: CorrespondenceRevision[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;
}
```

```typescript
// File: backend/src/modules/correspondence/entities/correspondence-revision.entity.ts
@Entity('correspondence_revisions')
export class CorrespondenceRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  correspondence_id: number;

  @Column({ default: 1 })
  revision_number: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  details: any; // Dynamic JSON field

  @Column()
  created_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;

  // Relationships
  @ManyToOne(() => Correspondence, (corr) => corr.revisions)
  @JoinColumn({ name: 'correspondence_id' })
  correspondence: Correspondence;

  @ManyToMany(() => Attachment)
  @JoinTable({
    name: 'correspondence_attachments',
    joinColumn: { name: 'correspondence_revision_id' },
    inverseJoinColumn: { name: 'attachment_id' },
  })
  attachments: Attachment[];
}
```

### 2. Service

```typescript
// File: backend/src/modules/correspondence/correspondence.service.ts
@Injectable()
export class CorrespondenceService {
  constructor(
    @InjectRepository(Correspondence)
    private corrRepo: Repository<Correspondence>,
    @InjectRepository(CorrespondenceRevision)
    private revisionRepo: Repository<CorrespondenceRevision>,
    private fileStorage: FileStorageService,
    private docNumbering: DocumentNumberingService,
    private workflowEngine: WorkflowEngineService,
    private dataSource: DataSource
  ) {}

  async create(
    dto: CreateCorrespondenceDto,
    userId: number
  ): Promise<Correspondence> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Generate document number
      const docNumber = await this.docNumbering.generateNextNumber({
        projectId: dto.project_id,
        organizationId: dto.originator_organization_id,
        typeId: dto.correspondence_type_id,
        disciplineId: dto.discipline_id,
      });

      // 2. Create correspondence master
      const correspondence = manager.create(Correspondence, {
        correspondence_number: docNumber,
        title: dto.title,
        project_id: dto.project_id,
        originator_organization_id: dto.originator_organization_id,
        recipient_organization_id: dto.recipient_organization_id,
        correspondence_type_id: dto.correspondence_type_id,
        discipline_id: dto.discipline_id,
        status: 'draft',
        created_by_user_id: userId,
      });
      await manager.save(correspondence);

      // 3. Create initial revision
      const revision = manager.create(CorrespondenceRevision, {
        correspondence_id: correspondence.id,
        revision_number: 1,
        description: dto.description,
        details: dto.details,
        created_by_user_id: userId,
      });
      await manager.save(revision);

      // 4. Commit temp files (if any)
      if (dto.temp_file_ids?.length > 0) {
        const attachments = await this.fileStorage.commitFiles(
          dto.temp_file_ids,
          correspondence.id,
          'correspondence',
          manager
        );

        // Link attachments to revision
        revision.attachments = attachments;
        await manager.save(revision);
      }

      // 5. Create workflow instance
      const workflowInstance = await this.workflowEngine.createInstance(
        'CORRESPONDENCE_ROUTING',
        'correspondence',
        correspondence.id,
        manager
      );

      return correspondence;
    });
  }

  async createRevision(
    correspondenceId: number,
    dto: CreateRevisionDto,
    userId: number
  ): Promise<CorrespondenceRevision> {
    return this.dataSource.transaction(async (manager) => {
      // Get latest revision number
      const latestRevision = await manager.findOne(CorrespondenceRevision, {
        where: { correspondence_id: correspondenceId },
        order: { revision_number: 'DESC' },
      });

      const nextRevisionNumber = (latestRevision?.revision_number || 0) + 1;

      // Create new revision
      const revision = manager.create(CorrespondenceRevision, {
        correspondence_id: correspondenceId,
        revision_number: nextRevisionNumber,
        description: dto.description,
        details: dto.details,
        created_by_user_id: userId,
      });

      await manager.save(revision);

      // Commit temp files
      if (dto.temp_file_ids?.length > 0) {
        const attachments = await this.fileStorage.commitFiles(
          dto.temp_file_ids,
          correspondenceId,
          'correspondence',
          manager
        );

        revision.attachments = attachments;
        await manager.save(revision);
      }

      return revision;
    });
  }

  async findAll(
    query: SearchCorrespondenceDto
  ): Promise<PaginatedResult<Correspondence>> {
    const queryBuilder = this.corrRepo
      .createQueryBuilder('corr')
      .leftJoinAndSelect('corr.project', 'project')
      .leftJoinAndSelect('corr.originatorOrganization', 'org')
      .leftJoinAndSelect('corr.revisions', 'revision')
      .where('corr.deleted_at IS NULL');

    // Apply filters
    if (query.project_id) {
      queryBuilder.andWhere('corr.project_id = :projectId', {
        projectId: query.project_id,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('corr.status = :status', { status: query.status });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(corr.title LIKE :search OR corr.correspondence_number LIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await queryBuilder
      .orderBy('corr.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Correspondence> {
    const correspondence = await this.corrRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: [
        'revisions',
        'revisions.attachments',
        'project',
        'originatorOrganization',
      ],
      order: { revisions: { revision_number: 'DESC' } },
    });

    if (!correspondence) {
      throw new NotFoundException(`Correspondence #${id} not found`);
    }

    return correspondence;
  }

  async submitForRouting(id: number, userId: number): Promise<void> {
    const correspondence = await this.findOne(id);

    if (correspondence.status !== 'draft') {
      throw new BadRequestException('Can only submit draft correspondences');
    }

    // Execute workflow transition
    await this.workflowEngine.executeTransition(
      correspondence.id,
      'SUBMIT',
      userId
    );

    // Update status
    await this.corrRepo.update(id, { status: 'submitted' });
  }

  async softDelete(id: number, userId: number): Promise<void> {
    const correspondence = await this.findOne(id);

    if (correspondence.status !== 'draft') {
      throw new BadRequestException('Can only delete draft correspondences');
    }

    await this.corrRepo.softDelete(id);
  }
}
```

### 3. Controller

```typescript
// File: backend/src/modules/correspondence/correspondence.controller.ts
@Controller('correspondences')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiTags('Correspondences')
export class CorrespondenceController {
  constructor(private service: CorrespondenceService) {}

  @Post()
  @RequirePermission('correspondence.create')
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Body() dto: CreateCorrespondenceDto,
    @CurrentUser() user: User
  ): Promise<Correspondence> {
    return this.service.create(dto, user.user_id);
  }

  @Post(':id/revisions')
  @RequirePermission('correspondence.edit')
  async createRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRevisionDto,
    @CurrentUser() user: User
  ): Promise<CorrespondenceRevision> {
    return this.service.createRevision(id, dto, user.user_id);
  }

  @Get()
  @RequirePermission('correspondence.view')
  async findAll(@Query() query: SearchCorrespondenceDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermission('correspondence.view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/submit')
  @RequirePermission('correspondence.submit')
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User
  ): Promise<void> {
    return this.service.submitForRouting(id, user.user_id);
  }

  @Delete(':id')
  @RequirePermission('correspondence.delete')
  @HttpCode(204)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User
  ): Promise<void> {
    return this.service.softDelete(id, user.user_id);
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('CorrespondenceService', () => {
  it('should create correspondence with document number', async () => {
    const dto = {
      title: 'Test Correspondence',
      project_id: 1,
      originator_organization_id: 3,
      recipient_organization_id: 1,
      correspondence_type_id: 1,
    };

    const result = await service.create(dto, 1);

    expect(result.correspondence_number).toMatch(/^TEAM-RFA-\d{4}-\d{4}$/);
    expect(result.revisions).toHaveLength(1);
  });
});
```

### 2. Integration Tests

```bash
# Create correspondence
curl -X POST http://localhost:3000/correspondences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "title": "Test Correspondence",
    "project_id": 1,
    "originator_organization_id": 3,
    "recipient_organization_id": 1,
    "correspondence_type_id": 1,
    "temp_file_ids": ["temp-id-123"]
  }'
```

---

## 📚 Related Documents

- [Data Model - Correspondences](../02-architecture/data-model.md#correspondences)
- [Functional Requirements - Correspondence](../01-requirements/03.2-correspondence.md)

---

## 📦 Deliverables

- [ ] Correspondence Entity
- [ ] CorrespondenceRevision Entity
- [ ] CorrespondenceService (CRUD + Workflow)
- [ ] CorrespondenceController
- [ ] DTOs (Create, Update, Search)
- [ ] Unit Tests (85% coverage)
- [ ] Integration Tests
- [ ] API Documentation (Swagger)

---

## 🚨 Risks & Mitigation

| Risk                      | Impact   | Mitigation                     |
| ------------------------- | -------- | ------------------------------ |
| Document number collision | Critical | Double-lock mechanism          |
| File orphans              | Medium   | Two-phase storage              |
| Workflow state mismatch   | High     | Transaction-safe state updates |

---

## 📌 Notes

- Use Master-Revision pattern (separate tables)
- Auto-generate document number on create
- Workflow integration required for submit
- Soft delete only drafts
- Pagination default: 20 items per page
