// File: src/modules/user/user.service.ts
// บันทึกการแก้ไข: แก้ไข Error TS1272 โดยใช้ 'import type' สำหรับ Cache interface (T1.3)

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager'; // ✅ FIX: เพิ่ม 'type' ตรงนี้
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 1. สร้างผู้ใช้ (Hash Password ก่อนบันทึก)
  async create(createUserDto: CreateUserDto): Promise<User> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const newUser = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    try {
      return await this.usersRepository.save(newUser);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Username or Email already exists');
      }
      throw error;
    }
  }

  // 2. ดึงข้อมูลทั้งหมด
  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: [
        'user_id',
        'username',
        'email',
        'firstName',
        'lastName',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  // 3. ดึงข้อมูลรายคน
  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { user_id: id },
      relations: ['preferences', 'roles'], // [IMPORTANT] ต้องโหลด preferences มาด้วย
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  // 4. แก้ไขข้อมูล
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    const updatedUser = this.usersRepository.merge(user, updateUserDto);
    const savedUser = await this.usersRepository.save(updatedUser);

    // ⚠️ สำคัญ: เมื่อมีการแก้ไขข้อมูล User ต้องเคลียร์ Cache สิทธิ์เสมอ
    await this.clearUserCache(id);

    return savedUser;
  }

  // 5. ลบผู้ใช้ (Soft Delete)
  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.softDelete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    // เคลียร์ Cache เมื่อลบ
    await this.clearUserCache(id);
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
    const permissions = await this.usersRepository.query(
      `SELECT permission_name FROM v_user_all_permissions WHERE user_id = ?`,
      [userId],
    );

    const permissionList = permissions.map((row: any) => row.permission_name);

    // 3. บันทึกลง Cache (TTL 1800 วินาที = 30 นาที)
    await this.cacheManager.set(cacheKey, permissionList, 1800 * 1000);

    return permissionList;
  }

  /**
   * Helper สำหรับล้าง Cache เมื่อมีการเปลี่ยนแปลงสิทธิ์หรือบทบาท
   */
  async clearUserCache(userId: number): Promise<void> {
    await this.cacheManager.del(`permissions:user:${userId}`);
  }
}
