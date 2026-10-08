import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationRole } from './entities/organization-role.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationRole)
    private readonly roleRepo: Repository<OrganizationRole>
  ) {}

  async create(dto: CreateOrganizationDto) {
    const existing = await this.orgRepo.findOne({
      where: { organizationCode: dto.organizationCode },
    });
    if (existing) {
      throw new ConflictException(
        `Organization Code "${dto.organizationCode}" already exists`
      );
    }
    const org = this.orgRepo.create(dto);
    return this.orgRepo.save(org);
  }

  async findAll(params?: {
    search?: string;
    roleId?: number;
    projectId?: number;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      search,
      roleId,
      projectId,
      isActive,
      page = 1,
      limit = 100,
    } = params || {};
    const skip = (page - 1) * limit;

    // Start with a basic query builder to handle dynamic conditions easily
    const queryBuilder = this.orgRepo.createQueryBuilder('org');

    if (search) {
      queryBuilder.andWhere(
        '(org.organizationCode LIKE :search OR org.organizationName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Filter isActive — ใช้ !== undefined เพราะ isActive=false ก็ต้อง filter (ห้ามใช้ truthy check)
    if (isActive !== undefined) {
      queryBuilder.andWhere('org.isActive = :isActive', { isActive });
    }

    // [Refactor] Filter by roleId — องค์กรที่ถือ role นี้ใน contract หรือ project ใดก็ได้
    // (organizations.role_id ถูกตัดออก — role มีความหมายเฉพาะใน context ของ contract/project)
    if (roleId) {
      queryBuilder.andWhere(
        `EXISTS (
           SELECT 1 FROM contract_organizations co
           WHERE co.organization_id = org.id AND co.role_id = :roleId
         ) OR EXISTS (
           SELECT 1 FROM project_organizations po_role
           WHERE po_role.organization_id = org.id AND po_role.role_id = :roleId
         )`,
        { roleId }
      );
    }

    // [New] Support filtering by projectId (e.g. organizations in a project)
    if (projectId) {
      queryBuilder.innerJoin(
        'project_organizations',
        'po',
        'po.organization_id = org.id AND po.project_id = :projectId',
        { projectId }
      );
    }

    queryBuilder.orderBy('org.organizationCode', 'ASC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ID ${id} not found`);
    return org;
  }

  async findOneByUuid(publicId: string) {
    const org = await this.orgRepo.findOne({ where: { publicId } });
    if (!org)
      throw new NotFoundException(
        `Organization publicId ${publicId} not found`
      );
    return org;
  }

  async update(uuid: string, dto: UpdateOrganizationDto) {
    const org = await this.findOneByUuid(uuid);
    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  async remove(uuid: string) {
    const org = await this.findOneByUuid(uuid);
    return this.orgRepo.remove(org);
  }

  async findAllActive() {
    return this.orgRepo.find({
      where: { isActive: true },
      order: { organizationCode: 'ASC' },
    });
  }

  // ---- Organization Roles (master) ----

  /**
   * ดึงรายการ role ทั้งหมดขององค์กร — ใช้เป็น options ให้หน้า assign role
   */
  async findRoles() {
    return this.roleRepo.find({ order: { id: 'ASC' } });
  }

  /**
   * แปลง role_name → internal id
   * (organization_roles ไม่มี uuid — role_name เป็น unique natural key จึงใช้เป็น public identifier)
   */
  async resolveRoleId(roleName: string): Promise<number> {
    const role = await this.roleRepo.findOne({ where: { roleName } });
    if (!role) {
      throw new NotFoundException(`Organization role "${roleName}" not found`);
    }
    return role.id;
  }
}
