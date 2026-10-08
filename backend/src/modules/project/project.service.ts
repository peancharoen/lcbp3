import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions';

// Entities
import { Project } from './entities/project.entity';
import { ProjectOrganization } from './entities/project-organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

// DTOs
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SearchProjectDto } from './dto/search-project.dto';
import { LinkOrganizationDto } from '../organization/dto/link-organization.dto';
import { UpdateLinkedOrganizationRoleDto } from '../organization/dto/update-linked-organization-role.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(ProjectOrganization)
    private projectOrgRepo: Repository<ProjectOrganization>,
    private organizationService: OrganizationService,
    private uuidResolver: UuidResolverService
  ) {}

  // --- CRUD Operations ---

  async create(createDto: CreateProjectDto) {
    // 1. เช็คชื่อ/รหัสซ้ำ (ถ้าจำเป็น)
    const existing = await this.projectRepository.findOne({
      where: { projectCode: createDto.projectCode },
    });
    if (existing) {
      throw new ConflictException(
        `Project Code "${createDto.projectCode}" already exists`
      );
    }

    // 2. สร้าง Project
    const project = this.projectRepository.create(createDto);
    return this.projectRepository.save(project);
  }

  async findAll(searchDto: SearchProjectDto) {
    const { search, isActive, page = 1, limit = 20 } = searchDto;
    const skip = (page - 1) * limit;

    // สร้าง Query Builder
    const query = this.projectRepository.createQueryBuilder('project');

    // ADR-042: กรอง Sandbox Project ออกเสมอ — ไม่รับ override จาก query param
    query.andWhere('project.isSandbox = :isSandbox', { isSandbox: false });

    if (isActive !== undefined) {
      query.andWhere('project.isActive = :isActive', { isActive });
    }

    if (search) {
      query.andWhere(
        '(project.projectCode LIKE :search OR project.projectName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    query.orderBy('project.createdAt', 'DESC');
    query.skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['contracts'], // ดึงสัญญาที่เกี่ยวข้องมาด้วย
    });

    if (!project) {
      throw new NotFoundException(`Project ID ${id} not found`);
    }

    return project;
  }

  async findOneByUuid(publicId: string) {
    const project = await this.projectRepository.findOne({
      where: { publicId },
      relations: ['contracts'],
    });

    if (!project) {
      throw new NotFoundException(
        `Project with publicId ${publicId} not found`
      );
    }

    return project;
  }

  async update(publicId: string, updateDto: UpdateProjectDto) {
    const project = await this.findOneByUuid(publicId);

    // ADR-042: ป้องกันการเปลี่ยน is_active ของ Sandbox Project
    if (project.isSandbox && updateDto.isActive !== undefined) {
      throw new BusinessException(
        'SANDBOX_PROJECT_LOCKED',
        'Cannot change is_active of sandbox project',
        'ไม่สามารถเปลี่ยนสถานะของโครงการทดสอบได้'
      );
    }

    // Merge ข้อมูลใหม่ใส่ข้อมูลเดิม
    this.projectRepository.merge(project, updateDto);

    return this.projectRepository.save(project);
  }

  async remove(publicId: string) {
    const project = await this.findOneByUuid(publicId);
    // ใช้ Soft Delete
    return this.projectRepository.softRemove(project);
  }

  async findContracts(publicId: string) {
    const project = await this.findOneByUuid(publicId);
    return project.contracts;
  }

  // --- Organization Helper ---

  async findAllOrganizations() {
    return this.organizationService.findAllActive();
  }

  // --- Project ↔ Organization Links (role per context — PR #29) ---

  /** แปลง junction row เป็น API shape — expose เฉพาะ publicId ไม่รั่ว internal id (ADR-019) */
  private toLinkedOrganization(link: ProjectOrganization) {
    return {
      organizationId: link.organization?.publicId ?? null,
      organizationCode: link.organization?.organizationCode ?? null,
      organizationName: link.organization?.organizationName ?? null,
      roleName: link.organizationRole?.roleName ?? null,
    };
  }

  /** ดึงองค์กรทั้งหมดที่ผูกกับ project พร้อม role ใน context นั้น */
  async listOrganizations(publicId: string) {
    const project = await this.findOneByUuid(publicId);
    const links = await this.projectOrgRepo.find({
      where: { projectId: project.id },
      relations: ['organization', 'organizationRole'],
    });
    return links.map((link) => this.toLinkedOrganization(link));
  }

  /** ผูกองค์กรเข้า project พร้อม role — PK (project_id, organization_id) กันซ้ำที่ DB ด้วย */
  async linkOrganization(publicId: string, dto: LinkOrganizationDto) {
    const project = await this.findOneByUuid(publicId);
    const organizationId = await this.uuidResolver.resolveOrganizationId(
      dto.organizationId
    );
    const roleId = await this.organizationService.resolveRoleId(dto.roleName);

    const existing = await this.projectOrgRepo.findOne({
      where: { projectId: project.id, organizationId },
    });
    if (existing) {
      throw new ConflictException(
        'Organization is already linked to this project'
      );
    }

    const link = this.projectOrgRepo.create({
      projectId: project.id,
      organizationId,
      roleId,
    });
    await this.projectOrgRepo.save(link);

    const saved = await this.projectOrgRepo.findOneOrFail({
      where: { projectId: project.id, organizationId },
      relations: ['organization', 'organizationRole'],
    });
    return this.toLinkedOrganization(saved);
  }

  /** เปลี่ยน role ขององค์กรที่ผูกอยู่แล้ว — role มีความหมายเฉพาะ context นี้ */
  async updateOrganizationRole(
    publicId: string,
    orgUuid: string,
    dto: UpdateLinkedOrganizationRoleDto
  ) {
    const project = await this.findOneByUuid(publicId);
    const organizationId =
      await this.uuidResolver.resolveOrganizationId(orgUuid);

    const link = await this.projectOrgRepo.findOne({
      where: { projectId: project.id, organizationId },
      relations: ['organization', 'organizationRole'],
    });
    if (!link) {
      throw new NotFoundException('Organization is not linked to this project');
    }

    const roleId = await this.organizationService.resolveRoleId(dto.roleName);
    // ใช้ update() ไม่ใช่ save(link) — entity มี organizationRole relation ที่โหลดมา
    // แล้ว (ค่าเก่า) ทำให้ save() cascade เขียน role เดิมทับ roleId ใหม่กลับคืน
    await this.projectOrgRepo.update(
      { projectId: project.id, organizationId },
      { roleId }
    );

    const saved = await this.projectOrgRepo.findOneOrFail({
      where: { projectId: project.id, organizationId },
      relations: ['organization', 'organizationRole'],
    });
    return this.toLinkedOrganization(saved);
  }

  /** ถอดองค์กรออกจาก project — junction เป็น pure link table ลบจริงได้ (ไม่มี deleted_at) */
  async unlinkOrganization(publicId: string, orgUuid: string) {
    const project = await this.findOneByUuid(publicId);
    const organizationId =
      await this.uuidResolver.resolveOrganizationId(orgUuid);

    const result = await this.projectOrgRepo.delete({
      projectId: project.id,
      organizationId,
    });
    if (!result.affected) {
      throw new NotFoundException('Organization is not linked to this project');
    }
    return { deleted: true };
  }
}
