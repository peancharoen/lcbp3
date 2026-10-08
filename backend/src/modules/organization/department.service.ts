// File: backend/src/modules/organization/department.service.ts
// Change Log:
// - 2026-10-06: Initial creation — CRUD departments (User Grouping Model)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import {
  NotFoundException,
  ConflictException,
} from '../../common/exceptions/base.exception';

/**
 * CRUD สำหรับแผนกภายในองค์กร (org-scoped master)
 */
@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /** ดึงแผนกทั้งหมดของ org (ตาม publicId) */
  async findAllByOrg(orgPublicId: string): Promise<Department[]> {
    const orgId = await this.uuidResolver.resolveOrganizationId(orgPublicId);
    return this.deptRepo.find({
      where: { organizationId: orgId },
      order: { departmentCode: 'ASC' },
    });
  }

  async create(
    orgPublicId: string,
    dto: CreateDepartmentDto
  ): Promise<Department> {
    const orgId = await this.uuidResolver.resolveOrganizationId(orgPublicId);
    const existing = await this.deptRepo.findOne({
      where: { organizationId: orgId, departmentCode: dto.departmentCode },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        'DEPARTMENT_DUPLICATE',
        `Department code '${dto.departmentCode}' already exists in this organization`
      );
    }
    const dept = this.deptRepo.create({ ...dto, organizationId: orgId });
    return this.deptRepo.save(dept);
  }

  async update(
    deptPublicId: string,
    dto: UpdateDepartmentDto
  ): Promise<Department> {
    const dept = await this.deptRepo.findOne({
      where: { publicId: deptPublicId },
    });
    if (!dept) throw new NotFoundException('Department', deptPublicId);
    if (dto.departmentCode && dto.departmentCode !== dept.departmentCode) {
      const dup = await this.deptRepo.findOne({
        where: {
          organizationId: dept.organizationId,
          departmentCode: dto.departmentCode,
        },
      });
      if (dup) {
        throw new ConflictException(
          'DEPARTMENT_DUPLICATE',
          `Department code '${dto.departmentCode}' already exists in this organization`
        );
      }
    }
    Object.assign(dept, dto);
    return this.deptRepo.save(dept);
  }

  /** Soft delete แผนก */
  async remove(deptPublicId: string): Promise<void> {
    const dept = await this.deptRepo.findOne({
      where: { publicId: deptPublicId },
    });
    if (!dept) throw new NotFoundException('Department', deptPublicId);
    await this.deptRepo.softRemove(dept);
  }
}
