# Task: Drawing Module (Shop & Contract Drawings)

**Status:** In Progress
**Priority:** P2 (Medium - Supporting Module)
**Estimated Effort:** 6-8 days
**Dependencies:** TASK-BE-001, TASK-BE-002, TASK-BE-003, TASK-BE-004
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Drawing Module สำหรับจัดการ Shop Drawings (แบบก่อสร้าง) และ Contract Drawings (แบบคู่สัญญา)

---

## 🎯 Objectives

- ✅ Contract Drawing Management
- ✅ Shop Drawing with Master-Revision Pattern
- ✅ Drawing Categories
- ✅ Drawing References/Links
- ✅ Version Control
- ✅ Search & Filter

---

## 📝 Acceptance Criteria

1. **Contract Drawings:**

   - ✅ Upload contract drawings
   - ✅ Categorize by discipline
   - ✅ Link to project/contract
   - ✅ Search by drawing number

2. **Shop Drawings:**

   - ✅ Create shop drawing with auto-number
   - ✅ Create revisions
   - ✅ Link to contract drawings
   - ✅ Track submission status

3. **Drawing Management:**
   - ✅ Version tracking
   - ✅ Drawing categories
   - ✅ Cross-references
   - ✅ Attachment management

---

## 🛠️ Implementation Steps

### 1. Entities

```typescript
// File: backend/src/modules/drawing/entities/contract-drawing.entity.ts
@Entity('contract_drawings')
export class ContractDrawing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  drawing_number: string;

  @Column({ length: 500 })
  drawing_title: string;

  @Column()
  contract_id: number;

  @Column({ nullable: true })
  discipline_id: number;

  @Column({ nullable: true })
  category_id: number;

  @Column({ type: 'date', nullable: true })
  issue_date: Date;

  @Column({ length: 50, nullable: true })
  revision: string;

  @Column({ nullable: true })
  attachment_id: number; // PDF file

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @ManyToOne(() => Discipline)
  @JoinColumn({ name: 'discipline_id' })
  discipline: Discipline;

  @ManyToOne(() => Attachment)
  @JoinColumn({ name: 'attachment_id' })
  attachment: Attachment;

  @Index(['contract_id', 'drawing_number'], { unique: true })
  _contractDrawingIndex: void;
}
```

```typescript
// File: backend/src/modules/drawing/entities/shop-drawing.entity.ts
@Entity('shop_drawings')
export class ShopDrawing extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  drawing_number: string;

  @Column({ length: 500 })
  drawing_title: string;

  @Column()
  project_id: number;

  @Column()
  contractor_organization_id: number;

  @Column({ nullable: true })
  discipline_id: number;

  @Column({ nullable: true })
  category_id: number;

  @Column({ default: 'draft' })
  status: string;

  @Column()
  created_by_user_id: number;

  @DeleteDateColumn()
  deleted_at: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => ShopDrawingRevision, (rev) => rev.shopDrawing)
  revisions: ShopDrawingRevision[];

  @ManyToMany(() => ContractDrawing)
  @JoinTable({
    name: 'shop_drawing_references',
    joinColumn: { name: 'shop_drawing_id' },
    inverseJoinColumn: { name: 'contract_drawing_id' },
  })
  contractDrawingReferences: ContractDrawing[];
}
```

```typescript
// File: backend/src/modules/drawing/entities/shop-drawing-revision.entity.ts
@Entity('shop_drawing_revisions')
export class ShopDrawingRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shop_drawing_id: number;

  @Column({ default: 1 })
  revision_number: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ type: 'date', nullable: true })
  submission_date: Date;

  @Column()
  created_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => ShopDrawing, (sd) => sd.revisions)
  @JoinColumn({ name: 'shop_drawing_id' })
  shopDrawing: ShopDrawing;

  @ManyToMany(() => Attachment)
  @JoinTable({
    name: 'shop_drawing_attachments',
    joinColumn: { name: 'shop_drawing_revision_id' },
    inverseJoinColumn: { name: 'attachment_id' },
  })
  attachments: Attachment[];
}
```

### 2. Service

```typescript
// File: backend/src/modules/drawing/drawing.service.ts
@Injectable()
export class DrawingService {
  constructor(
    @InjectRepository(ContractDrawing)
    private contractDrawingRepo: Repository<ContractDrawing>,
    @InjectRepository(ShopDrawing)
    private shopDrawingRepo: Repository<ShopDrawing>,
    @InjectRepository(ShopDrawingRevision)
    private shopRevisionRepo: Repository<ShopDrawingRevision>,
    private fileStorage: FileStorageService,
    private docNumbering: DocumentNumberingService,
    private dataSource: DataSource
  ) {}

  // Contract Drawing Methods
  async createContractDrawing(
    dto: CreateContractDrawingDto,
    userId: number
  ): Promise<ContractDrawing> {
    return this.dataSource.transaction(async (manager) => {
      // Commit drawing file
      const attachments = await this.fileStorage.commitFiles(
        [dto.temp_file_id],
        null,
        'contract_drawing',
        manager
      );

      const contractDrawing = manager.create(ContractDrawing, {
        drawing_number: dto.drawing_number,
        drawing_title: dto.drawing_title,
        contract_id: dto.contract_id,
        discipline_id: dto.discipline_id,
        category_id: dto.category_id,
        issue_date: dto.issue_date,
        revision: dto.revision || 'A',
        attachment_id: attachments[0].id,
      });

      return manager.save(contractDrawing);
    });
  }

  async findAllContractDrawings(
    query: SearchDrawingDto
  ): Promise<PaginatedResult<ContractDrawing>> {
    const queryBuilder = this.contractDrawingRepo
      .createQueryBuilder('cd')
      .leftJoinAndSelect('cd.contract', 'contract')
      .leftJoinAndSelect('cd.discipline', 'discipline')
      .leftJoinAndSelect('cd.attachment', 'attachment')
      .where('cd.deleted_at IS NULL');

    if (query.contract_id) {
      queryBuilder.andWhere('cd.contract_id = :contractId', {
        contractId: query.contract_id,
      });
    }

    if (query.discipline_id) {
      queryBuilder.andWhere('cd.discipline_id = :disciplineId', {
        disciplineId: query.discipline_id,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(cd.drawing_number LIKE :search OR cd.drawing_title LIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await queryBuilder
      .orderBy('cd.drawing_number', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Shop Drawing Methods
  async createShopDrawing(
    dto: CreateShopDrawingDto,
    userId: number
  ): Promise<ShopDrawing> {
    return this.dataSource.transaction(async (manager) => {
      // Generate drawing number
      const drawingNumber = await this.docNumbering.generateNextNumber({
        projectId: dto.project_id,
        organizationId: dto.contractor_organization_id,
        typeId: 999, // Shop Drawing type
        disciplineId: dto.discipline_id,
      });

      // Create shop drawing master
      const shopDrawing = manager.create(ShopDrawing, {
        drawing_number: drawingNumber,
        drawing_title: dto.drawing_title,
        project_id: dto.project_id,
        contractor_organization_id: dto.contractor_organization_id,
        discipline_id: dto.discipline_id,
        category_id: dto.category_id,
        status: 'draft',
        created_by_user_id: userId,
      });
      await manager.save(shopDrawing);

      // Create initial revision
      const revision = manager.create(ShopDrawingRevision, {
        shop_drawing_id: shopDrawing.id,
        revision_number: 1,
        description: dto.description,
        details: dto.details,
        submission_date: dto.submission_date,
        created_by_user_id: userId,
      });
      await manager.save(revision);

      // Commit files
      if (dto.temp_file_ids?.length > 0) {
        const attachments = await this.fileStorage.commitFiles(
          dto.temp_file_ids,
          shopDrawing.id,
          'shop_drawing',
          manager
        );
        revision.attachments = attachments;
        await manager.save(revision);
      }

      // Link contract drawing references
      if (dto.contract_drawing_ids?.length > 0) {
        const contractDrawings = await manager.findByIds(
          ContractDrawing,
          dto.contract_drawing_ids
        );
        shopDrawing.contractDrawingReferences = contractDrawings;
        await manager.save(shopDrawing);
      }

      return shopDrawing;
    });
  }

  async createShopDrawingRevision(
    shopDrawingId: number,
    dto: CreateShopDrawingRevisionDto,
    userId: number
  ): Promise<ShopDrawingRevision> {
    return this.dataSource.transaction(async (manager) => {
      const latestRevision = await manager.findOne(ShopDrawingRevision, {
        where: { shop_drawing_id: shopDrawingId },
        order: { revision_number: 'DESC' },
      });

      const nextRevisionNumber = (latestRevision?.revision_number || 0) + 1;

      const revision = manager.create(ShopDrawingRevision, {
        shop_drawing_id: shopDrawingId,
        revision_number: nextRevisionNumber,
        description: dto.description,
        details: dto.details,
        submission_date: dto.submission_date,
        created_by_user_id: userId,
      });

      await manager.save(revision);

      if (dto.temp_file_ids?.length > 0) {
        const attachments = await this.fileStorage.commitFiles(
          dto.temp_file_ids,
          shopDrawingId,
          'shop_drawing',
          manager
        );
        revision.attachments = attachments;
        await manager.save(revision);
      }

      return revision;
    });
  }

  async findAllShopDrawings(
    query: SearchDrawingDto
  ): Promise<PaginatedResult<ShopDrawing>> {
    const queryBuilder = this.shopDrawingRepo
      .createQueryBuilder('sd')
      .leftJoinAndSelect('sd.project', 'project')
      .leftJoinAndSelect('sd.revisions', 'revisions')
      .leftJoinAndSelect('sd.contractDrawingReferences', 'refs')
      .where('sd.deleted_at IS NULL');

    if (query.project_id) {
      queryBuilder.andWhere('sd.project_id = :projectId', {
        projectId: query.project_id,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(sd.drawing_number LIKE :search OR sd.drawing_title LIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await queryBuilder
      .orderBy('sd.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneShopDrawing(id: number): Promise<ShopDrawing> {
    const shopDrawing = await this.shopDrawingRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: [
        'revisions',
        'revisions.attachments',
        'contractDrawingReferences',
        'project',
      ],
      order: { revisions: { revision_number: 'DESC' } },
    });

    if (!shopDrawing) {
      throw new NotFoundException(`Shop Drawing #${id} not found`);
    }

    return shopDrawing;
  }
}
```

### 3. Controller

```typescript
// File: backend/src/modules/drawing/drawing.controller.ts
@Controller('drawings')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiTags('Drawings')
export class DrawingController {
  constructor(private service: DrawingService) {}

  // Contract Drawings
  @Post('contract')
  @RequirePermission('drawing.create')
  async createContractDrawing(
    @Body() dto: CreateContractDrawingDto,
    @CurrentUser() user: User
  ) {
    return this.service.createContractDrawing(dto, user.user_id);
  }

  @Get('contract')
  @RequirePermission('drawing.view')
  async findAllContractDrawings(@Query() query: SearchDrawingDto) {
    return this.service.findAllContractDrawings(query);
  }

  // Shop Drawings
  @Post('shop')
  @RequirePermission('drawing.create')
  @UseInterceptors(IdempotencyInterceptor)
  async createShopDrawing(
    @Body() dto: CreateShopDrawingDto,
    @CurrentUser() user: User
  ) {
    return this.service.createShopDrawing(dto, user.user_id);
  }

  @Post('shop/:id/revisions')
  @RequirePermission('drawing.edit')
  async createShopDrawingRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateShopDrawingRevisionDto,
    @CurrentUser() user: User
  ) {
    return this.service.createShopDrawingRevision(id, dto, user.user_id);
  }

  @Get('shop')
  @RequirePermission('drawing.view')
  async findAllShopDrawings(@Query() query: SearchDrawingDto) {
    return this.service.findAllShopDrawings(query);
  }

  @Get('shop/:id')
  @RequirePermission('drawing.view')
  async findOneShopDrawing(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneShopDrawing(id);
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('DrawingService', () => {
  it('should create contract drawing with PDF', async () => {
    const dto = {
      drawing_number: 'A-001',
      drawing_title: 'Floor Plan',
      contract_id: 1,
      temp_file_id: 'temp-pdf-id',
    };

    const result = await service.createContractDrawing(dto, 1);
    expect(result.attachment_id).toBeDefined();
  });

  it('should create shop drawing with auto number', async () => {
    const dto = {
      drawing_title: 'Shop Drawing Test',
      project_id: 1,
      contractor_organization_id: 3,
      contract_drawing_ids: [1, 2],
    };

    const result = await service.createShopDrawing(dto, 1);
    expect(result.drawing_number).toMatch(/^TEAM-SD-\d{4}-\d{4}$/);
    expect(result.contractDrawingReferences).toHaveLength(2);
  });
});
```

---

## 📚 Related Documents

- [Data Model - Drawings](../02-architecture/data-model.md#drawings)
- [Functional Requirements - Drawings](../01-requirements/03.4-contract-drawing.md)

---

## 📦 Deliverables

- [ ] ContractDrawing Entity
- [ ] ShopDrawing & ShopDrawingRevision Entities
- [ ] DrawingService (Both types)
- [ ] DrawingController
- [ ] DTOs
- [ ] Unit Tests (80% coverage)
- [ ] API Documentation

---

## 🚨 Risks & Mitigation

| Risk                       | Impact | Mitigation                        |
| -------------------------- | ------ | --------------------------------- |
| Large drawing files        | Medium | File size validation, compression |
| Drawing reference tracking | Medium | Junction table management         |
| Version confusion          | Low    | Clear revision numbering          |

---

## 📌 Notes

- Contract drawings: PDF uploads only
- Shop drawings: Auto-numbered with revisions
- Cross-references tracked in junction table
- Categories and disciplines from master data
