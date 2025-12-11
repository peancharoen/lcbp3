import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>
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

  async findAll(params?: any) {
    const { search, roleId, projectId, page = 1, limit = 100 } = params || {};
    const skip = (page - 1) * limit;

    // Start with a basic query builder to handle dynamic conditions easily
    const queryBuilder = this.orgRepo.createQueryBuilder('org');

    if (search) {
      queryBuilder.andWhere(
        '(org.organizationCode LIKE :search OR org.organizationName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // [Refactor] Support filtering by roleId (e.g., getting all CONTRACTORS)
    if (roleId) {
      // Assuming there is a relation or a way to filter by role.
      // If Organization has a roleId column directly:
      queryBuilder.andWhere('org.roleId = :roleId', { roleId });
    }

    // [New] Support filtering by projectId (e.g. organizations in a project)
    // Assuming a Many-to-Many or One-to-Many relation exists via ProjectOrganization
    if (projectId) {
      // Use raw join to avoid circular dependency with ProjectOrganization entity
      queryBuilder.innerJoin(
        'project_organizations',
        'po',
        'po.organization_id = org.id AND po.project_id = :projectId',
        { projectId }
      );
    }

    queryBuilder.orderBy('org.organizationCode', 'ASC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    // Debug logging
    console.log(`[OrganizationService] Found ${total} organizations`);

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

  async update(id: number, dto: UpdateOrganizationDto) {
    const org = await this.findOne(id);
    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  async remove(id: number) {
    const org = await this.findOne(id);
    // Hard delete or Soft delete? Schema doesn't have deleted_at for Organization, but let's check.
    // Schema says: created_at, updated_at. No deleted_at.
    // So hard delete.
    return this.orgRepo.remove(org);
  }

  async findAllActive() {
    return this.orgRepo.find({
      where: { isActive: true },
      order: { organizationCode: 'ASC' },
    });
  }
}
