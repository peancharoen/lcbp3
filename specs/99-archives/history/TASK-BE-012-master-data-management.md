# Task: Master Data Management Module

**Status:** Completed
**Priority:** P1 (High - Required for System Setup)
**Estimated Effort:** 6-8 days
**Dependencies:** TASK-BE-001 (Database), TASK-BE-002 (Auth)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Master Data Management Module สำหรับจัดการข้อมูลหลักของระบบ ที่ใช้สำหรับ Configuration และ Dropdown Lists

---

## 🎯 Objectives

- ✅ Organization Management (CRUD)
- ✅ Project & Contract Management
- ✅ Type/Category Management
- ✅ Discipline Management
- ✅ Code Management (RFA Approve Codes, etc.)
- ✅ User Preferences

---

## 📝 Acceptance Criteria

1. **Organization Management:**

   - ✅ Create/Update/Delete organizations
   - ✅ Active/Inactive toggle
   - ✅ Organization hierarchy (if needed)
   - ✅ Unique organization codes

2. **Project & Contract Management:**

   - ✅ Create/Update/Delete projects
   - ✅ Link projects to organizations
   - ✅ Create/Update/Delete contracts
   - ✅ Link contracts to projects

3. **Type Management:**

   - ✅ Correspondence Types CRUD
   - ✅ RFA Types CRUD
   - ✅ Drawing Categories CRUD
   - ✅ Correspondence Sub Types CRUD

4. **Discipline Management:**

   - ✅ Create/Update disciplines
   - ✅ Discipline codes (GEN, STR, ARC, etc.)
   - ✅ Active/Inactive status

5. **Code Management:**
   - ✅ RFA Approve Codes CRUD
   - ✅ Other lookup codes

---

## 🛠️ Implementation Steps

### 1. Organization Module

```typescript
// File: backend/src/modules/master-data/organization/organization.service.ts
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>
  ) {}

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    // Check unique code
    const existing = await this.orgRepo.findOne({
      where: { organization_code: dto.organization_code },
    });

    if (existing) {
      throw new ConflictException('Organization code already exists');
    }

    const organization = this.orgRepo.create({
      organization_code: dto.organization_code,
      organization_name: dto.organization_name,
      organization_name_en: dto.organization_name_en,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      is_active: true,
    });

    return this.orgRepo.save(organization);
  }

  async update(id: number, dto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);

    // Check unique code if changed
    if (
      dto.organization_code &&
      dto.organization_code !== organization.organization_code
    ) {
      const existing = await this.orgRepo.findOne({
        where: { organization_code: dto.organization_code },
      });

      if (existing) {
        throw new ConflictException('Organization code already exists');
      }
    }

    Object.assign(organization, dto);
    return this.orgRepo.save(organization);
  }

  async findAll(includeInactive: boolean = false): Promise<Organization[]> {
    const where: any = {};
    if (!includeInactive) {
      where.is_active = true;
    }

    return this.orgRepo.find({
      where,
      order: { organization_code: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Organization> {
    const organization = await this.orgRepo.findOne({ where: { id } });

    if (!organization) {
      throw new NotFoundException(`Organization #${id} not found`);
    }

    return organization;
  }

  async toggleActive(id: number): Promise<Organization> {
    const organization = await this.findOne(id);
    organization.is_active = !organization.is_active;
    return this.orgRepo.save(organization);
  }

  async delete(id: number): Promise<void> {
    // Check if organization has any related data
    const hasProjects = await this.hasRelatedProjects(id);
    if (hasProjects) {
      throw new BadRequestException(
        'Cannot delete organization with related projects'
      );
    }

    await this.orgRepo.softDelete(id);
  }

  private async hasRelatedProjects(organizationId: number): Promise<boolean> {
    const count = await this.orgRepo
      .createQueryBuilder('org')
      .leftJoin(
        'projects',
        'p',
        'p.client_organization_id = org.id OR p.consultant_organization_id = org.id'
      )
      .where('org.id = :id', { id: organizationId })
      .getCount();

    return count > 0;
  }
}
```

### 2. Project & Contract Module

```typescript
// File: backend/src/modules/master-data/project/project.service.ts
@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>
  ) {}

  async createProject(dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepo.create({
      project_code: dto.project_code,
      project_name: dto.project_name,
      project_name_en: dto.project_name_en,
      client_organization_id: dto.client_organization_id,
      consultant_organization_id: dto.consultant_organization_id,
      start_date: dto.start_date,
      end_date: dto.end_date,
      is_active: true,
    });

    return this.projectRepo.save(project);
  }

  async createContract(dto: CreateContractDto): Promise<Contract> {
    // Verify project exists
    const project = await this.projectRepo.findOne({
      where: { id: dto.project_id },
    });

    if (!project) {
      throw new NotFoundException(`Project #${dto.project_id} not found`);
    }

    const contract = this.contractRepo.create({
      contract_number: dto.contract_number,
      contract_name: dto.contract_name,
      project_id: dto.project_id,
      contractor_organization_id: dto.contractor_organization_id,
      start_date: dto.start_date,
      end_date: dto.end_date,
      contract_value: dto.contract_value,
      is_active: true,
    });

    return this.contractRepo.save(contract);
  }

  async findAllProjects(): Promise<Project[]> {
    return this.projectRepo.find({
      where: { is_active: true },
      relations: ['clientOrganization', 'consultantOrganization', 'contracts'],
      order: { project_code: 'ASC' },
    });
  }

  async findProjectContracts(projectId: number): Promise<Contract[]> {
    return this.contractRepo.find({
      where: { project_id: projectId, is_active: true },
      relations: ['contractorOrganization'],
      order: { contract_number: 'ASC' },
    });
  }
}
```

### 3. Type Management Service

```typescript
// File: backend/src/modules/master-data/type/type.service.ts
@Injectable()
export class TypeService {
  constructor(
    @InjectRepository(CorrespondenceType)
    private corrTypeRepo: Repository<CorrespondenceType>,
    @InjectRepository(RfaType)
    private rfaTypeRepo: Repository<RfaType>,
    @InjectRepository(DrawingCategory)
    private drawingCategoryRepo: Repository<DrawingCategory>,
    @InjectRepository(CorrespondenceSubType)
    private corrSubTypeRepo: Repository<CorrespondenceSubType>
  ) {}

  // Correspondence Types
  async createCorrespondenceType(
    dto: CreateTypeDto
  ): Promise<CorrespondenceType> {
    const type = this.corrTypeRepo.create({
      type_code: dto.type_code,
      type_name: dto.type_name,
      is_active: true,
    });

    return this.corrTypeRepo.save(type);
  }

  async findAllCorrespondenceTypes(): Promise<CorrespondenceType[]> {
    return this.corrTypeRepo.find({
      where: { is_active: true },
      order: { type_code: 'ASC' },
    });
  }

  // RFA Types
  async createRfaType(dto: CreateTypeDto): Promise<RfaType> {
    const type = this.rfaTypeRepo.create({
      type_code: dto.type_code,
      type_name: dto.type_name,
      is_active: true,
    });

    return this.rfaTypeRepo.save(type);
  }

  async findAllRfaTypes(): Promise<RfaType[]> {
    return this.rfaTypeRepo.find({
      where: { is_active: true },
      order: { type_code: 'ASC' },
    });
  }

  // Drawing Categories
  async createDrawingCategory(dto: CreateTypeDto): Promise<DrawingCategory> {
    const category = this.drawingCategoryRepo.create({
      category_code: dto.type_code,
      category_name: dto.type_name,
      is_active: true,
    });

    return this.drawingCategoryRepo.save(category);
  }

  async findAllDrawingCategories(): Promise<DrawingCategory[]> {
    return this.drawingCategoryRepo.find({
      where: { is_active: true },
      order: { category_code: 'ASC' },
    });
  }

  // Correspondence Sub Types
  async createCorrespondenceSubType(
    dto: CreateSubTypeDto
  ): Promise<CorrespondenceSubType> {
    const subType = this.corrSubTypeRepo.create({
      correspondence_type_id: dto.correspondence_type_id,
      sub_type_code: dto.sub_type_code,
      sub_type_name: dto.sub_type_name,
      is_active: true,
    });

    return this.corrSubTypeRepo.save(subType);
  }

  async findCorrespondenceSubTypes(
    typeId: number
  ): Promise<CorrespondenceSubType[]> {
    return this.corrSubTypeRepo.find({
      where: { correspondence_type_id: typeId, is_active: true },
      order: { sub_type_code: 'ASC' },
    });
  }
}
```

### 4. Discipline Management

```typescript
// File: backend/src/modules/master-data/discipline/discipline.service.ts
@Injectable()
export class DisciplineService {
  constructor(
    @InjectRepository(Discipline)
    private disciplineRepo: Repository<Discipline>
  ) {}

  async create(dto: CreateDisciplineDto): Promise<Discipline> {
    const existing = await this.disciplineRepo.findOne({
      where: { discipline_code: dto.discipline_code },
    });

    if (existing) {
      throw new ConflictException('Discipline code already exists');
    }

    const discipline = this.disciplineRepo.create({
      discipline_code: dto.discipline_code,
      discipline_name: dto.discipline_name,
      is_active: true,
    });

    return this.disciplineRepo.save(discipline);
  }

  async findAll(): Promise<Discipline[]> {
    return this.disciplineRepo.find({
      where: { is_active: true },
      order: { discipline_code: 'ASC' },
    });
  }

  async update(id: number, dto: UpdateDisciplineDto): Promise<Discipline> {
    const discipline = await this.disciplineRepo.findOne({ where: { id } });

    if (!discipline) {
      throw new NotFoundException(`Discipline #${id} not found`);
    }

    Object.assign(discipline, dto);
    return this.disciplineRepo.save(discipline);
  }
}
```

### 5. RFA Approve Codes

```typescript
// File: backend/src/modules/master-data/code/code.service.ts
@Injectable()
export class CodeService {
  constructor(
    @InjectRepository(RfaApproveCode)
    private rfaApproveCodeRepo: Repository<RfaApproveCode>
  ) {}

  async createRfaApproveCode(
    dto: CreateApproveCodeDto
  ): Promise<RfaApproveCode> {
    const code = this.rfaApproveCodeRepo.create({
      code: dto.code,
      description: dto.description,
      is_active: true,
    });

    return this.rfaApproveCodeRepo.save(code);
  }

  async findAllRfaApproveCodes(): Promise<RfaApproveCode[]> {
    return this.rfaApproveCodeRepo.find({
      where: { is_active: true },
      order: { code: 'ASC' },
    });
  }
}
```

### 6. Master Data Controller

```typescript
// File: backend/src/modules/master-data/master-data.controller.ts
@Controller('master-data')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiTags('Master Data')
export class MasterDataController {
  constructor(
    private organizationService: OrganizationService,
    private projectService: ProjectService,
    private typeService: TypeService,
    private disciplineService: DisciplineService,
    private codeService: CodeService
  ) {}

  // Organizations
  @Get('organizations')
  async getOrganizations() {
    return this.organizationService.findAll();
  }

  @Post('organizations')
  @RequirePermission('master_data.manage')
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Put('organizations/:id')
  @RequirePermission('master_data.manage')
  async updateOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto
  ) {
    return this.organizationService.update(id, dto);
  }

  // Projects
  @Get('projects')
  async getProjects() {
    return this.projectService.findAllProjects();
  }

  @Post('projects')
  @RequirePermission('master_data.manage')
  async createProject(@Body() dto: CreateProjectDto) {
    return this.projectService.createProject(dto);
  }

  // Contracts
  @Get('projects/:projectId/contracts')
  async getProjectContracts(
    @Param('projectId', ParseIntPipe) projectId: number
  ) {
    return this.projectService.findProjectContracts(projectId);
  }

  @Post('contracts')
  @RequirePermission('master_data.manage')
  async createContract(@Body() dto: CreateContractDto) {
    return this.projectService.createContract(dto);
  }

  // Correspondence Types
  @Get('correspondence-types')
  async getCorrespondenceTypes() {
    return this.typeService.findAllCorrespondenceTypes();
  }

  @Post('correspondence-types')
  @RequirePermission('master_data.manage')
  async createCorrespondenceType(@Body() dto: CreateTypeDto) {
    return this.typeService.createCorrespondenceType(dto);
  }

  // RFA Types
  @Get('rfa-types')
  async getRfaTypes() {
    return this.typeService.findAllRfaTypes();
  }

  // Disciplines
  @Get('disciplines')
  async getDisciplines() {
    return this.disciplineService.findAll();
  }

  @Post('disciplines')
  @RequirePermission('master_data.manage')
  async createDiscipline(@Body() dto: CreateDisciplineDto) {
    return this.disciplineService.create(dto);
  }

  // RFA Approve Codes
  @Get('rfa-approve-codes')
  async getRfaApproveCodes() {
    return this.codeService.findAllRfaApproveCodes();
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('OrganizationService', () => {
  it('should create organization with unique code', async () => {
    const dto = {
      organization_code: 'TEST',
      organization_name: 'Test Organization',
    };

    const result = await service.create(dto);

    expect(result.organization_code).toBe('TEST');
    expect(result.is_active).toBe(true);
  });

  it('should throw error when creating duplicate code', async () => {
    await expect(
      service.create({
        organization_code: 'TEAM',
        organization_name: 'Duplicate',
      })
    ).rejects.toThrow(ConflictException);
  });

  it('should prevent deletion of organization with projects', async () => {
    await expect(service.delete(1)).rejects.toThrow(BadRequestException);
  });
});

describe('ProjectService', () => {
  it('should create project with contracts', async () => {
    const project = await service.createProject({
      project_code: 'LCBP3',
      project_name: 'Laem Chabang Phase 3',
      client_organization_id: 1,
      consultant_organization_id: 2,
    });

    expect(project.project_code).toBe('LCBP3');
  });
});
```

### 2. Integration Tests

```bash
# Get all organizations
curl http://localhost:3000/master-data/organizations

# Create organization
curl -X POST http://localhost:3000/master-data/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_code": "ABC",
    "organization_name": "ABC Company"
  }'

# Get projects
curl http://localhost:3000/master-data/projects

# Get disciplines
curl http://localhost:3000/master-data/disciplines
```

---

## 📚 Related Documents

- [Data Model - Master Data](../02-architecture/data-model.md#core--master-data)
- [Data Dictionary v1.4.5](../../docs/4_Data_Dictionary_V1_4_5.md)

---

## 📦 Deliverables

- [ ] OrganizationService (CRUD)
- [ ] ProjectService & ContractService
- [ ] TypeService (Correspondence, RFA, Drawing)
- [ ] DisciplineService
- [ ] CodeService (RFA Approve Codes)
- [ ] MasterDataController (unified endpoints)
- [ ] DTOs for all entities
- [ ] Unit Tests (80% coverage)
- [ ] Integration Tests
- [ ] API Documentation (Swagger)
- [ ] Seed data scripts

---

## 🚨 Risks & Mitigation

| Risk                    | Impact | Mitigation                        |
| ----------------------- | ------ | --------------------------------- |
| Duplicate codes         | Medium | Unique constraints + validation   |
| Circular dependencies   | Low    | Proper foreign key design         |
| Deletion with relations | High   | Check relations before delete     |
| Data integrity          | High   | Use transactions for related data |

---

## 📌 Notes

- All master data tables have `is_active` flag
- Soft delete for organizations and projects
- Unique codes enforced at database level
- Organization deletion checks for related projects
- Seed data required for initial setup
- Admin-only access for create/update/delete
- Public read access for dropdown lists
- Cache frequently accessed master data (Redis)
