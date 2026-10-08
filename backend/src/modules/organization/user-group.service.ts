// File: backend/src/modules/organization/user-group.service.ts
// Change Log:
// - 2026-10-06: Initial creation — CRUD user_groups + members (User Grouping Model)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGroup } from './entities/user-group.entity';
import { UserGroupMember } from './entities/user-group-member.entity';
import { CreateUserGroupDto, UpdateUserGroupDto } from './dto/user-group.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import {
  NotFoundException,
  ConflictException,
} from '../../common/exceptions/base.exception';

/**
 * CRUD สำหรับ functional group ของ user ภายใน org (เช่น "ทีม QC")
 * ใช้เป็น pool สำหรับ claim-based assignment / notification fan-out
 */
@Injectable()
export class UserGroupService {
  private readonly logger = new Logger(UserGroupService.name);

  constructor(
    @InjectRepository(UserGroup)
    private readonly groupRepo: Repository<UserGroup>,
    @InjectRepository(UserGroupMember)
    private readonly memberRepo: Repository<UserGroupMember>,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /** ดึงกลุ่มทั้งหมดของ org (optional filter isActive) */
  async findAllByOrg(orgPublicId?: string): Promise<UserGroup[]> {
    if (!orgPublicId) {
      return this.groupRepo.find({
        relations: ['organization'],
        order: { name: 'ASC' },
      });
    }
    const orgId = await this.uuidResolver.resolveOrganizationId(orgPublicId);
    return this.groupRepo.find({
      where: { organizationId: orgId },
      order: { name: 'ASC' },
    });
  }

  async findOne(publicId: string): Promise<UserGroup> {
    const group = await this.groupRepo.findOne({
      where: { publicId },
      relations: ['members', 'members.user', 'organization'],
    });
    if (!group) throw new NotFoundException('UserGroup', publicId);
    return group;
  }

  async create(dto: CreateUserGroupDto): Promise<UserGroup> {
    const orgId = await this.uuidResolver.resolveOrganizationId(
      dto.organizationId
    );
    const existing = await this.groupRepo.findOne({
      where: { organizationId: orgId, name: dto.name },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        'USER_GROUP_DUPLICATE',
        `Group name '${dto.name}' already exists in this organization`
      );
    }
    const group = this.groupRepo.create({
      organizationId: orgId,
      name: dto.name,
      description: dto.description,
    });
    const saved = await this.groupRepo.save(group);

    if (dto.memberIds?.length) {
      const memberIds = await Promise.all(
        dto.memberIds.map((id) => this.uuidResolver.resolveUserId(id))
      );
      await this.memberRepo.save(
        memberIds.map((userId) =>
          this.memberRepo.create({ groupId: saved.id, userId })
        )
      );
    }
    return this.findOne(saved.publicId);
  }

  async update(publicId: string, dto: UpdateUserGroupDto): Promise<UserGroup> {
    const group = await this.findOne(publicId);
    if (dto.name && dto.name !== group.name) {
      const dup = await this.groupRepo.findOne({
        where: { organizationId: group.organizationId, name: dto.name },
      });
      if (dup) {
        throw new ConflictException(
          'USER_GROUP_DUPLICATE',
          `Group name '${dto.name}' already exists in this organization`
        );
      }
    }
    Object.assign(group, dto);
    await this.groupRepo.save(group);
    return this.findOne(publicId);
  }

  /** Soft delete group (members ถูก CASCADE ที่ junction) */
  async remove(publicId: string): Promise<void> {
    const group = await this.findOne(publicId);
    await this.groupRepo.softRemove(group);
  }

  /** เพิ่ม member (user publicId) เข้ากลุ่ม */
  async addMember(
    groupPublicId: string,
    userPublicId: string
  ): Promise<UserGroup> {
    const group = await this.findOne(groupPublicId);
    const userId = await this.uuidResolver.resolveUserId(userPublicId);
    const existing = await this.memberRepo.findOne({
      where: { groupId: group.id, userId },
    });
    if (!existing) {
      await this.memberRepo.save(
        this.memberRepo.create({ groupId: group.id, userId })
      );
    }
    return this.findOne(groupPublicId);
  }

  /** ลบ member ออกจากกลุ่ม */
  async removeMember(
    groupPublicId: string,
    userPublicId: string
  ): Promise<void> {
    const group = await this.findOne(groupPublicId);
    const userId = await this.uuidResolver.resolveUserId(userPublicId);
    await this.memberRepo.delete({ groupId: group.id, userId });
  }

  /** เช็คว่า user เป็น member ของ group (internal id) — ใช้โดย circulation claim logic */
  async isMember(userId: number, groupId: number): Promise<boolean> {
    const count = await this.memberRepo.count({
      where: { groupId, userId },
    });
    return count > 0;
  }

  /** ดึง user_ids ทั้งหมดของ group — ใช้โดย notification fan-out / reminder resolver */
  async getMemberUserIds(groupId: number): Promise<number[]> {
    const members = await this.memberRepo.find({ where: { groupId } });
    return members.map((m) => m.userId);
  }
}
