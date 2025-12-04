import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity.js';
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

  async findAll() {
    return this.orgRepo.find({
      order: { organizationCode: 'ASC' },
    });
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
