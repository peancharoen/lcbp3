// File: src/modules/user/user.service.ts
// บันทึกการแก้ไข: แก้ไข Error TS1272 โดยใช้ 'import type' สำหรับ Cache interface (T1.3)

import { Injectable, Inject } from '@nestjs/common';
import {
  NotFoundException,
  ConflictException,
  ValidationException,
} from '../../common/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager'; // ✅ FIX: เพิ่ม 'type' ตรงนี้
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserAssignment } from './entities/user-assignment.entity';
import { UserOrganization } from './entities/user-organization.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Department } from '../organization/entities/department.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import {
  AddUserOrganizationDto,
  UpdateUserOrganizationDto,
} from './dto/user-organization.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserAssignment)
    private assignmentRepository: Repository<UserAssignment>,
    @InjectRepository(UserOrganization)
    private membershipRepository: Repository<UserOrganization>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private uuidResolver: UuidResolverService,
    private dataSource: DataSource
  ) {}

  // 1. สร้างผู้ใช้ (Hash Password ก่อนบันทึก) + มอบหมาย Role (Global scope) ถ้าระบุ roleIds
  async create(createUserDto: CreateUserDto, actor?: User): Promise<User> {
    const salt = await bcrypt.genSalt(12); // ADR-016: 12 salt rounds
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    // ADR-019: Resolve UUID→INT for primaryOrganizationId
    const resolvedOrgId = createUserDto.primaryOrganizationId
      ? await this.uuidResolver.resolveOrganizationId(
          createUserDto.primaryOrganizationId
        )
      : undefined;

    // roleIds ไม่ใช่คอลัมน์ของ users — แยกออกก่อนสร้าง entity
    const { roleIds, ...userData } = createUserDto;
    if (roleIds?.length) {
      await this.assertRolesExist(roleIds);
    }

    try {
      // Transaction: user + user_assignments ต้องสำเร็จพร้อมกัน (กัน user ไม่มี role ค้าง)
      return await this.dataSource.transaction(async (manager) => {
        const newUser = manager.create(User, {
          ...userData,
          primaryOrganizationId: resolvedOrgId,
          password: hashedPassword,
        });
        const savedUser = await manager.save(newUser);

        // User Grouping Model: สร้าง membership row (is_primary=1) ให้สอดคล้องกับ primary_organization_id
        if (resolvedOrgId) {
          const resolvedDeptId = createUserDto.departmentId
            ? await this.uuidResolver.resolveDepartmentId(
                createUserDto.departmentId
              )
            : undefined;
          await manager.save(
            manager.create(UserOrganization, {
              userId: savedUser.user_id,
              organizationId: resolvedOrgId,
              departmentId: resolvedDeptId,
              position: createUserDto.position,
              isPrimary: true,
            })
          );
        }

        if (roleIds?.length) {
          const assignments = [...new Set(roleIds)].map((roleId) =>
            manager.create(UserAssignment, {
              userId: savedUser.user_id,
              roleId,
              assignedByUserId: actor?.user_id,
            })
          );
          await manager.save(assignments);
        }

        return savedUser;
      });
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      if (dbError.code === 'ER_DUP_ENTRY') {
        throw new ConflictException(
          'USER_DUPLICATE',
          'Username or Email already exists',
          'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว',
          ['ลองใช้ชื่อผู้ใช้หรืออีเมลอื่น']
        );
      }
      throw error;
    }
  }

  // 2. ดึงข้อมูลทั้งหมด (Search & Pagination)
  async findAll(params?: SearchUserDto): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      search,
      roleId,
      primaryOrganizationId,
      page = 1,
      limit = 100,
    } = params || {};

    // Create query builder
    const query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.preference', 'preference') // Optional
      .leftJoinAndSelect('user.assignments', 'assignments')
      .leftJoinAndSelect('assignments.role', 'role')
      .leftJoinAndSelect('user.organization', 'organization') // [FIX] Required for primaryOrganizationPublicId getter (ADR-019)
      .select([
        'user.user_id',
        'user.publicId',
        'user.username',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.lineId',
        'user.isActive',
        'user.mustChangePassword',
        'user.failedAttempts',
        'user.lockedUntil',
        'user.lastLoginAt',
        'user.createdAt',
        'user.updatedAt',
        'user.telegramChatId', // Feature 258 — telegramStatus derivation (ไม่ serialize — @Exclude)
        'user.telegramUsername',
        'user.telegramLinkedAt',
        'assignments.id',
        'role.roleId',
        'role.roleName',
        'role.publicId',
        'organization.publicId',
        'organization.organizationCode',
        'organization.organizationName',
      ]);

    // Apply Filters
    if (search) {
      query.andWhere(
        '(user.username LIKE :search OR user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (primaryOrganizationId) {
      // ADR-019: Resolve UUID→INT for filtering
      const resolvedOrgId = await this.uuidResolver.resolveOrganizationId(
        primaryOrganizationId
      );
      query.andWhere('user.primaryOrganizationId = :orgId', {
        orgId: resolvedOrgId,
      });
    }

    if (roleId) {
      query.andWhere('role.roleId = :roleId', { roleId });
    }

    // Pagination
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();

    // Feature 258 (T055): telegramStatus ต่อ row — linked / blocked / none
    // blocked = มี delivery FAILED ด้วย permanent code ล่าสุด (BOT_BLOCKED/CHAT_NOT_FOUND)
    await this.attachTelegramStatus(data);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 3. ดึงข้อมูลรายคน
  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { user_id: id },
      relations: [
        'preference',
        'assignments',
        'assignments.role',
        'assignments.role.permissions', // [FIX] Required for RBAC AbilityFactory
        'organization', // [FIX] Required for primaryOrganizationPublicId getter (ADR-019)
      ],
    });

    if (!user) {
      throw new NotFoundException('User', String(id));
    }

    return user;
  }

  async findOneByUuid(publicId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { publicId },
      relations: [
        'preference',
        'assignments',
        'assignments.role',
        'assignments.role.permissions',
        'organization', // [FIX] Required for primaryOrganizationPublicId getter (ADR-019)
      ],
    });

    if (!user) {
      throw new NotFoundException('User', publicId);
    }

    return user;
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  // 4. แก้ไขข้อมูล (+ sync Roles ถ้าส่ง roleIds มา)
  async update(
    uuid: string,
    updateUserDto: UpdateUserDto,
    actor?: User
  ): Promise<User> {
    const user = await this.findOneByUuid(uuid);

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(12); // ADR-016: 12 salt rounds
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    // roleIds ไม่ใช่คอลัมน์ของ users — แยกออกก่อน merge
    const { roleIds, ...dtoWithoutRoles } = updateUserDto;
    if (roleIds?.length) {
      await this.assertRolesExist(roleIds);
    }

    // ADR-019: Resolve UUID→INT for primaryOrganizationId before merge
    const resolvedDto: Record<string, unknown> = { ...dtoWithoutRoles };
    if (updateUserDto.primaryOrganizationId !== undefined) {
      resolvedDto.primaryOrganizationId =
        await this.uuidResolver.resolveOrganizationId(
          updateUserDto.primaryOrganizationId
        );
    }

    const updatedUser = this.usersRepository.merge(
      user,
      resolvedDto as Partial<User>
    );
    const savedUser = await this.usersRepository.save(updatedUser);

    // User Grouping Model: primary org เปลี่ยน → sync membership is_primary
    if (updateUserDto.primaryOrganizationId !== undefined) {
      await this.syncPrimaryMembership(
        user.user_id,
        resolvedDto.primaryOrganizationId as number | undefined
      );
    }

    if (roleIds !== undefined) {
      await this.syncRoleAssignments(user, roleIds, actor?.user_id);
    }

    // ⚠️ สำคัญ: เมื่อมีการแก้ไขข้อมูล User ต้องเคลียร์ Cache สิทธิ์เสมอ
    await this.clearUserCache(user.user_id);

    return savedUser;
  }

  // 5. ลบผู้ใช้ (Soft Delete)
  async remove(uuid: string): Promise<void> {
    const user = await this.findOneByUuid(uuid);
    const result = await this.usersRepository.softDelete(user.user_id);

    if (result.affected === 0) {
      throw new NotFoundException('User', uuid);
    }
    // เคลียร์ Cache เมื่อลบ
    await this.clearUserCache(user.user_id);
  }

  // --- User Organization Memberships (User Grouping Model) ---

  /** ดึง memberships ทั้งหมดของ user (พร้อม org/department) */
  async listMemberships(userPublicId: string): Promise<UserOrganization[]> {
    const userId = await this.uuidResolver.resolveUserId(userPublicId);
    return this.membershipRepository.find({
      where: { userId },
      relations: ['organization', 'department'],
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  /** เพิ่ม membership (user join org อีกตัว) — isPrimary=1 จะ sync users.primary_organization_id */
  async addMembership(
    userPublicId: string,
    dto: AddUserOrganizationDto
  ): Promise<UserOrganization> {
    const userId = await this.uuidResolver.resolveUserId(userPublicId);
    const organizationId = await this.uuidResolver.resolveOrganizationId(
      dto.organizationId
    );
    const departmentId = dto.departmentId
      ? await this.resolveDepartmentInOrg(dto.departmentId, organizationId)
      : undefined;

    const existing = await this.membershipRepository.findOne({
      where: { userId, organizationId },
    });
    if (existing) {
      throw new ConflictException(
        'MEMBERSHIP_DUPLICATE',
        'User is already a member of this organization'
      );
    }

    const membership = this.membershipRepository.create({
      userId,
      organizationId,
      departmentId,
      position: dto.position,
      isPrimary: dto.isPrimary ?? false,
    });
    const saved = await this.membershipRepository.save(membership);

    if (saved.isPrimary) {
      await this.setPrimaryOrg(userId, organizationId);
    } else {
      // ถ้ายังไม่มี primary เลย (เช่น user ถูกสร้างโดยไม่มี org) ให้ row แรกเป็น primary
      const primary = await this.membershipRepository.findOne({
        where: { userId, isPrimary: true },
      });
      if (!primary) {
        await this.setPrimaryOrg(userId, organizationId);
      }
    }
    return saved;
  }

  /** แก้ไข membership (แผนก/ตำแหน่ง/เป็น primary) */
  async updateMembership(
    userPublicId: string,
    membershipPublicId: string,
    dto: UpdateUserOrganizationDto
  ): Promise<UserOrganization> {
    const userId = await this.uuidResolver.resolveUserId(userPublicId);
    const membership = await this.membershipRepository.findOne({
      where: { publicId: membershipPublicId, userId },
    });
    if (!membership) {
      throw new NotFoundException('UserOrganization', membershipPublicId);
    }

    if (dto.departmentId !== undefined) {
      membership.departmentId = dto.departmentId
        ? await this.resolveDepartmentInOrg(
            dto.departmentId,
            membership.organizationId
          )
        : undefined;
    }
    if (dto.position !== undefined) {
      membership.position = dto.position;
    }
    const saved = await this.membershipRepository.save(membership);

    if (dto.isPrimary) {
      await this.setPrimaryOrg(userId, membership.organizationId);
    }
    return saved;
  }

  /** ลบ membership — ถ้าลบ primary row จะเคลียร์ users.primary_organization_id ด้วย */
  async removeMembership(
    userPublicId: string,
    membershipPublicId: string
  ): Promise<void> {
    const userId = await this.uuidResolver.resolveUserId(userPublicId);
    const membership = await this.membershipRepository.findOne({
      where: { publicId: membershipPublicId, userId },
    });
    if (!membership) {
      throw new NotFoundException('UserOrganization', membershipPublicId);
    }
    await this.membershipRepository.remove(membership);

    if (membership.isPrimary) {
      // โปรโมต row ที่เหลือถัดไปเป็น primary (หรือ NULL ถ้าไม่เหลือ)
      const next = await this.membershipRepository.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      if (next) {
        await this.setPrimaryOrg(userId, next.organizationId);
      } else {
        await this.usersRepository.update(userId, {
          primaryOrganizationId: null as unknown as number,
        });
      }
    }
  }

  /**
   * Sync membership กับ users.primary_organization_id (denormalized pointer)
   * — primary ใหม่ upsert row + ล้าง is_primary ของ row อื่น
   */
  private async syncPrimaryMembership(
    userId: number,
    organizationId: number | undefined
  ): Promise<void> {
    await this.membershipRepository.update({ userId }, { isPrimary: false });
    if (!organizationId) return;
    const existing = await this.membershipRepository.findOne({
      where: { userId, organizationId },
    });
    if (existing) {
      await this.membershipRepository.update(existing.id, {
        isPrimary: true,
      });
    } else {
      await this.membershipRepository.save(
        this.membershipRepository.create({
          userId,
          organizationId,
          isPrimary: true,
        })
      );
    }
  }

  /** ตั้ง primary org ทั้งสองฝั่ง (membership + users.primary_organization_id) */
  private async setPrimaryOrg(
    userId: number,
    organizationId: number
  ): Promise<void> {
    await this.syncPrimaryMembership(userId, organizationId);
    await this.usersRepository.update(userId, {
      primaryOrganizationId: organizationId,
    });
  }

  /** Resolve dept + ตรวจว่าอยู่ใน org เดียวกับ membership */
  private async resolveDepartmentInOrg(
    departmentId: number | string,
    organizationId: number
  ): Promise<number> {
    const deptId = await this.uuidResolver.resolveDepartmentId(departmentId);
    const dept = await this.departmentRepository.findOne({
      where: { id: deptId },
    });
    if (!dept) {
      throw new NotFoundException('Department', String(departmentId));
    }
    if (dept.organizationId !== organizationId) {
      throw new ValidationException(
        'Department does not belong to this organization',
        undefined,
        'แผนกที่เลือกไม่ได้อยู่ในองค์กรเดียวกัน'
      );
    }
    return deptId;
  }

  async findDocControlIdByOrg(organizationId: number): Promise<number | null> {
    const user = await this.usersRepository.findOne({
      where: { primaryOrganizationId: organizationId },
    });
    return user ? user.user_id : null;
  }

  /**
   * ✅ ดึงสิทธิ์ (Permission) โดยใช้ Caching Strategy
   * TTL: 30 นาที (ตาม Requirement 6.5.2)
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    const cacheKey = `permissions:user:${userId}`;

    // 1. ลองดึงจาก Cache ก่อน
    const cachedPermissions = await this.cacheManager.get<string[]>(cacheKey);
    if (cachedPermissions) {
      return cachedPermissions;
    }

    // 2. ถ้าไม่มีใน Cache ให้ Query จาก DB (View: v_user_all_permissions)
    const permissions = await this.usersRepository.query<
      { permission_name: string }[]
    >(`SELECT permission_name FROM v_user_all_permissions WHERE user_id = ?`, [
      userId,
    ]);

    const permissionList = permissions.map((row) => row.permission_name);

    // 3. บันทึกลง Cache (TTL 1800 วินาที = 30 นาที)
    await this.cacheManager.set(cacheKey, permissionList, 1800 * 1000);

    return permissionList;
  }

  // --- Roles & Permissions (Helper for Admin/UI) ---

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({ relations: ['permissions'] });
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find();
  }

  async updateRolePermissions(roleId: number, permissionIds: number[]) {
    const role = await this.roleRepository.findOne({
      where: { roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role', String(roleId));
    }

    // Load permissions entities
    const permissions = [];
    if (permissionIds.length > 0) {
      // Note: findByIds is deprecated in newer TypeORM, uses In() instead
      // but if current version supports it or using a simplified query:
      const perms = await this.permissionRepository
        .createQueryBuilder('p')
        .where('p.permissionId IN (:...ids)', { ids: permissionIds })
        .getMany();
      permissions.push(...perms);
    }

    role.permissions = permissions;
    return this.roleRepository.save(role);
  }

  /**
   * Helper สำหรับล้าง Cache เมื่อมีการเปลี่ยนแปลงสิทธิ์หรือบทบาท
   */
  async clearUserCache(userId: number): Promise<void> {
    await this.cacheManager.del(`permissions:user:${userId}`);
  }

  /**
   * ตรวจว่า roleIds ที่ส่งมามีอยู่จริงทั้งหมด (กัน FK violation เป็น 500)
   */
  private async assertRolesExist(roleIds: number[]): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds)];
    const found = await this.roleRepository.findBy({
      roleId: In(uniqueRoleIds),
    });
    const foundIds = new Set(found.map((r) => r.roleId));
    const missing = uniqueRoleIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ValidationException(
        `Invalid roleId(s): ${missing.join(', ')}`,
        undefined,
        'บทบาทที่เลือกไม่ถูกต้อง กรุณาเลือกบทบาทใหม่'
      );
    }
  }

  /**
   * Sync user_assignments ให้ตรงกับ roleIds ที่ admin เลือกในหน้า User Dialog
   * — role ที่ถูกเอาออกถูกลบทุก scope (UI แสดง role แบบ flat list)
   * — role ที่เพิ่มใหม่สร้างเป็น Global scope (ทุก scope เป็น NULL)
   */
  private async syncRoleAssignments(
    user: User,
    roleIds: number[],
    assignedByUserId?: number
  ): Promise<void> {
    const targetRoleIds = [...new Set(roleIds)];
    const current = user.assignments ?? [];
    const currentRoleIds = new Set(current.map((a) => a.roleId));

    const toRemove = current.filter((a) => !targetRoleIds.includes(a.roleId));
    const toAdd = targetRoleIds.filter((rid) => !currentRoleIds.has(rid));

    if (toRemove.length > 0) {
      await this.assignmentRepository.remove(toRemove);
    }
    if (toAdd.length > 0) {
      const rows = toAdd.map((roleId) =>
        this.assignmentRepository.create({
          userId: user.user_id,
          roleId,
          assignedByUserId,
        })
      );
      await this.assignmentRepository.save(rows);
    }
  }

  /**
   * Feature 258 (T055): แนบ `telegramStatus` ให้ user rows ใน list response
   * — 'linked' (ผูกปกติ) / 'blocked' (delivery ล่าสุด FAILED ด้วย permanent code)
   * / 'none' (ยังไม่ผูก) — batch query เดียว ไม่ N+1
   */
  private async attachTelegramStatus(users: User[]): Promise<void> {
    interface TelegramStatusRow extends User {
      telegramStatus?: 'linked' | 'blocked' | 'none';
    }
    const linked = users.filter((u) => !!u.telegramChatId);
    const blockedChatIds = new Set<string>();

    if (linked.length > 0) {
      const chatIds = linked.map((u) => u.telegramChatId as string);
      const failedRows = await this.dataSource.query<{ target: string }[]>(
        `SELECT DISTINCT target FROM notification_deliveries
         WHERE channel_type = 'TELEGRAM' AND status = 'FAILED'
           AND error_code IN ('BOT_BLOCKED', 'CHAT_NOT_FOUND')
           AND target IN (?)`,
        [chatIds]
      );
      for (const row of failedRows) {
        blockedChatIds.add(row.target);
      }
    }

    for (const u of users as TelegramStatusRow[]) {
      u.telegramStatus = !u.telegramChatId
        ? 'none'
        : blockedChatIds.has(u.telegramChatId)
          ? 'blocked'
          : 'linked';
    }
  }
}
