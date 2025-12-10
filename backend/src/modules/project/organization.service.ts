import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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
    const { search, page = 1, limit = 100 } = params || {};
    const skip = (page - 1) * limit;

    // Use findAndCount for safer, standard TypeORM queries
    const findOptions: any = {
      order: { organizationCode: 'ASC' },
      skip,
      take: limit,
    };

    if (search) {
      findOptions.where = [
        { organizationCode: Like(`%${search}%`) },
        { organizationName: Like(`%${search}%`) },
      ];
    }

    // Debug logging
    console.log(
      '[OrganizationService] Finding all with options:',
      JSON.stringify(findOptions)
    );

    const [data, total] = await this.orgRepo.findAndCount(findOptions);
    console.log(`[OrganizationService] Found ${total} organizations`);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
}
