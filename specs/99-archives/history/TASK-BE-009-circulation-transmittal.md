# Task: Circulation & Transmittal Modules

**Status:** In Progress
**Priority:** P2 (Medium)
**Estimated Effort:** 5-7 days
**Dependencies:** TASK-BE-001, TASK-BE-002, TASK-BE-003, TASK-BE-006
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Circulation Module (ใบเวียนภายใน) และ Transmittal Module (เอกสารนำส่ง) สำหรับจัดการการส่งเอกสารภายในและภายนอก

---

## 🎯 Objectives

- ✅ Circulation Sheet Management
- ✅ Transmittal Management
- ✅ Assignee Tracking
- ✅ Workflow Integration
- ✅ Document Linking

---

## 📝 Acceptance Criteria

1. **Circulation:**

   - ✅ Create circulation sheet
   - ✅ Add assignees (multiple users)
   - ✅ Link documents (correspondences, RFAs)
   - ✅ Track completion status

2. **Transmittal:**
   - ✅ Create transmittal
   - ✅ Add documents
   - ✅ Generate transmittal number
   - ✅ Print/Export transmittal letter

---

## 🛠️ Implementation Steps

### 1. Circulation Entities

```typescript
// File: backend/src/modules/circulation/entities/circulation.entity.ts
@Entity('circulations')
export class Circulation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  circulation_number: string;

  @Column({ length: 500 })
  subject: string;

  @Column()
  project_id: number;

  @Column()
  organization_id: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'date', nullable: true })
  due_date: Date;

  @Column()
  created_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => CirculationAssignee, (assignee) => assignee.circulation)
  assignees: CirculationAssignee[];

  @ManyToMany(() => Correspondence)
  @JoinTable({ name: 'circulation_correspondences' })
  correspondences: Correspondence[];
}
```

```typescript
// File: backend/src/modules/circulation/entities/circulation-assignee.entity.ts
@Entity('circulation_assignees')
export class CirculationAssignee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  circulation_id: number;

  @Column()
  user_id: number;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @ManyToOne(() => Circulation, (circ) => circ.assignees)
  @JoinColumn({ name: 'circulation_id' })
  circulation: Circulation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

### 2. Transmittal Entities

```typescript
// File: backend/src/modules/transmittal/entities/transmittal.entity.ts
@Entity('transmittals')
export class Transmittal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  transmittal_number: string;

  @Column({ length: 500 })
  attention_to: string;

  @Column()
  project_id: number;

  @Column()
  from_organization_id: number;

  @Column()
  to_organization_id: number;

  @Column({ type: 'date' })
  transmittal_date: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column()
  created_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => TransmittalItem, (item) => item.transmittal)
  items: TransmittalItem[];
}
```

```typescript
// File: backend/src/modules/transmittal/entities/transmittal-item.entity.ts
@Entity('transmittal_items')
export class TransmittalItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transmittal_id: number;

  @Column({ length: 50 })
  document_type: string; // 'correspondence', 'rfa', 'drawing'

  @Column()
  document_id: number;

  @Column({ length: 100 })
  document_number: string;

  @Column({ length: 500, nullable: true })
  document_title: string;

  @Column({ default: 1 })
  number_of_copies: number;

  @ManyToOne(() => Transmittal, (trans) => trans.items)
  @JoinColumn({ name: 'transmittal_id' })
  transmittal: Transmittal;
}
```

### 3. Services

```typescript
// File: backend/src/modules/circulation/circulation.service.ts
@Injectable()
export class CirculationService {
  constructor(
    @InjectRepository(Circulation)
    private circulationRepo: Repository<Circulation>,
    @InjectRepository(CirculationAssignee)
    private assigneeRepo: Repository<CirculationAssignee>,
    private docNumbering: DocumentNumberingService,
    private workflowEngine: WorkflowEngineService,
    private dataSource: DataSource
  ) {}

  async create(
    dto: CreateCirculationDto,
    userId: number
  ): Promise<Circulation> {
    return this.dataSource.transaction(async (manager) => {
      // Generate circulation number
      const circulationNumber = await this.docNumbering.generateNextNumber({
        projectId: dto.project_id,
        organizationId: dto.organization_id,
        typeId: 900, // Circulation type
      });

      // Create circulation
      const circulation = manager.create(Circulation, {
        circulation_number: circulationNumber,
        subject: dto.subject,
        project_id: dto.project_id,
        organization_id: dto.organization_id,
        due_date: dto.due_date,
        status: 'active',
        created_by_user_id: userId,
      });
      await manager.save(circulation);

      // Add assignees
      if (dto.assignee_user_ids?.length > 0) {
        const assignees = dto.assignee_user_ids.map((userId) =>
          manager.create(CirculationAssignee, {
            circulation_id: circulation.id,
            user_id: userId,
            status: 'pending',
          })
        );
        await manager.save(assignees);
      }

      // Link correspondences
      if (dto.correspondence_ids?.length > 0) {
        const correspondences = await manager.findByIds(
          Correspondence,
          dto.correspondence_ids
        );
        circulation.correspondences = correspondences;
        await manager.save(circulation);
      }

      // Create workflow instance
      await this.workflowEngine.createInstance(
        'CIRCULATION_INTERNAL',
        'circulation',
        circulation.id,
        manager
      );

      return circulation;
    });
  }

  async completeAssignment(
    circulationId: number,
    assigneeId: number,
    dto: CompleteAssignmentDto,
    userId: number
  ): Promise<void> {
    const assignee = await this.assigneeRepo.findOne({
      where: { id: assigneeId, circulation_id: circulationId, user_id: userId },
    });

    if (!assignee) {
      throw new NotFoundException('Assignment not found');
    }

    await this.assigneeRepo.update(assigneeId, {
      status: 'completed',
      remarks: dto.remarks,
      completed_at: new Date(),
    });

    // Check if all assignees completed
    const allAssignees = await this.assigneeRepo.find({
      where: { circulation_id: circulationId },
    });

    const allCompleted = allAssignees.every((a) => a.status === 'completed');

    if (allCompleted) {
      await this.circulationRepo.update(circulationId, { status: 'completed' });
      await this.workflowEngine.executeTransition(
        circulationId,
        'COMPLETE',
        userId
      );
    }
  }
}
```

```typescript
// File: backend/src/modules/transmittal/transmittal.service.ts
@Injectable()
export class TransmittalService {
  constructor(
    @InjectRepository(Transmittal)
    private transmittalRepo: Repository<Transmittal>,
    @InjectRepository(TransmittalItem)
    private itemRepo: Repository<TransmittalItem>,
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(Rfa)
    private rfaRepo: Repository<Rfa>,
    private docNumbering: DocumentNumberingService,
    private dataSource: DataSource
  ) {}

  async create(
    dto: CreateTransmittalDto,
    userId: number
  ): Promise<Transmittal> {
    return this.dataSource.transaction(async (manager) => {
      // Generate transmittal number
      const transmittalNumber = await this.docNumbering.generateNextNumber({
        projectId: dto.project_id,
        organizationId: dto.from_organization_id,
        typeId: 901, // Transmittal type
      });

      // Create transmittal
      const transmittal = manager.create(Transmittal, {
        transmittal_number: transmittalNumber,
        attention_to: dto.attention_to,
        project_id: dto.project_id,
        from_organization_id: dto.from_organization_id,
        to_organization_id: dto.to_organization_id,
        transmittal_date: dto.transmittal_date || new Date(),
        remarks: dto.remarks,
        created_by_user_id: userId,
      });
      await manager.save(transmittal);

      // Add items
      if (dto.items?.length > 0) {
        for (const itemDto of dto.items) {
          // Fetch document details
          const docDetails = await this.getDocumentDetails(
            itemDto.document_type,
            itemDto.document_id,
            manager
          );

          const item = manager.create(TransmittalItem, {
            transmittal_id: transmittal.id,
            document_type: itemDto.document_type,
            document_id: itemDto.document_id,
            document_number: docDetails.number,
            document_title: docDetails.title,
            number_of_copies: itemDto.number_of_copies || 1,
          });

          await manager.save(item);
        }
      }

      return transmittal;
    });
  }

  private async getDocumentDetails(
    type: string,
    id: number,
    manager: EntityManager
  ): Promise<{ number: string; title: string }> {
    switch (type) {
      case 'correspondence':
        const corr = await manager.findOne(Correspondence, { where: { id } });
        return { number: corr.correspondence_number, title: corr.title };

      case 'rfa':
        const rfa = await manager.findOne(Rfa, { where: { id } });
        return { number: rfa.rfa_number, title: rfa.subject };

      default:
        throw new BadRequestException(`Unknown document type: ${type}`);
    }
  }

  async findOne(id: number): Promise<Transmittal> {
    const transmittal = await this.transmittalRepo.findOne({
      where: { id },
      relations: ['items', 'project'],
    });

    if (!transmittal) {
      throw new NotFoundException(`Transmittal #${id} not found`);
    }

    return transmittal;
  }

  async generatePDF(id: number): Promise<Buffer> {
    const transmittal = await this.findOne(id);

    // Generate PDF using template
    // Implementation with library like pdfmake or puppeteer

    return Buffer.from('PDF content');
  }
}
```

### 4. Controllers

```typescript
// File: backend/src/modules/circulation/circulation.controller.ts
@Controller('circulations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CirculationController {
  constructor(private service: CirculationService) {}

  @Post()
  @RequirePermission('circulation.create')
  async create(@Body() dto: CreateCirculationDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.user_id);
  }

  @Post(':circulationId/assignees/:assigneeId/complete')
  @RequirePermission('circulation.complete')
  async completeAssignment(
    @Param('circulationId', ParseIntPipe) circulationId: number,
    @Param('assigneeId', ParseIntPipe) assigneeId: number,
    @Body() dto: CompleteAssignmentDto,
    @CurrentUser() user: User
  ) {
    return this.service.completeAssignment(
      circulationId,
      assigneeId,
      dto,
      user.user_id
    );
  }
}
```

```typescript
// File: backend/src/modules/transmittal/transmittal.controller.ts
@Controller('transmittals')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TransmittalController {
  constructor(private service: TransmittalService) {}

  @Post()
  @RequirePermission('transmittal.create')
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Body() dto: CreateTransmittalDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.user_id);
  }

  @Get(':id')
  @RequirePermission('transmittal.view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  @RequirePermission('transmittal.view')
  async downloadPDF(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response
  ) {
    const pdf = await this.service.generatePDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=transmittal-${id}.pdf`
    );
    res.send(pdf);
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('CirculationService', () => {
  it('should create circulation with assignees', async () => {
    const dto = {
      subject: 'Review Documents',
      project_id: 1,
      organization_id: 3,
      assignee_user_ids: [1, 2, 3],
      correspondence_ids: [10, 11],
    };

    const result = await service.create(dto, 1);

    expect(result.assignees).toHaveLength(3);
    expect(result.correspondences).toHaveLength(2);
  });
});

describe('TransmittalService', () => {
  it('should create transmittal with document items', async () => {
    const dto = {
      attention_to: 'Project Manager',
      project_id: 1,
      from_organization_id: 3,
      to_organization_id: 1,
      items: [
        { document_type: 'correspondence', document_id: 10 },
        { document_type: 'rfa', document_id: 5 },
      ],
    };

    const result = await service.create(dto, 1);

    expect(result.items).toHaveLength(2);
  });
});
```

---

## 📚 Related Documents

- [Functional Requirements - Circulation](../01-requirements/03.8-circulation-sheet.md)
- [Functional Requirements - Transmittal](../01-requirements/03.7-transmittals.md)

---

## 📦 Deliverables

- [ ] Circulation & CirculationAssignee Entities
- [ ] Transmittal & TransmittalItem Entities
- [ ] Services (Both modules)
- [ ] Controllers
- [ ] DTOs
- [ ] PDF Generation (Transmittal)
- [ ] Unit Tests (80% coverage)
- [ ] API Documentation

---

## 🚨 Risks & Mitigation

| Risk                      | Impact | Mitigation                   |
| ------------------------- | ------ | ---------------------------- |
| PDF generation complexity | Medium | Use proven library (pdfmake) |
| Multi-assignee tracking   | Medium | Clear status management      |
| Document linking          | Low    | Foreign key validation       |

---

## 📌 Notes

- Circulation tracks multiple assignees
- All assignees must complete before circulation closes
- Transmittal can include multiple document types
- PDF template for transmittal letter
- Auto-numbering for both modules
