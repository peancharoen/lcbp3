import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>, // ✅ ชื่อตัวแปรจริงคือ usersRepository
  ) {}

  // 1. สร้างผู้ใช้ (Hash Password ก่อนบันทึก)
  async create(createUserDto: CreateUserDto): Promise<User> {
    // สร้าง Salt และ Hash Password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    // เตรียมข้อมูล (เปลี่ยน password ธรรมดา เป็น password_hash)
    const newUser = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    try {
      // บันทึกลง DB
      return await this.usersRepository.save(newUser);
    } catch (error: any) {
      // เช็ค Error กรณี Username/Email ซ้ำ (MySQL Error Code 1062)
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Username or Email already exists');
      }
      throw error;
    }
  }

  // 2. ดึงข้อมูลทั้งหมด
  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      // ไม่ส่ง password กลับไปเพื่อความปลอดภัย
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
      where: { user_id: id }, // ใช้ user_id ตาม Entity
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  // ฟังก์ชันแถม: สำหรับ AuthService ใช้ (ต้องเห็น Password เพื่อเอาไปเทียบ)
  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  // 4. แก้ไขข้อมูล
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    // เช็คก่อนว่ามี User นี้ไหม
    const user = await this.findOne(id);

    // ถ้ามีการแก้รหัสผ่าน ต้อง Hash ใหม่ด้วย
    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    // รวมร่างข้อมูลเดิม + ข้อมูลใหม่
    const updatedUser = this.usersRepository.merge(user, updateUserDto);

    return this.usersRepository.save(updatedUser);
  }

  // 5. ลบผู้ใช้ (Soft Delete)
  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.softDelete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * หา User ID ของคนที่เป็น Document Control (หรือตัวแทน) ในองค์กร
   * เพื่อส่ง Notification
   */
  async findDocControlIdByOrg(organizationId: number): Promise<number | null> {
    // ✅ FIX: ใช้ usersRepository ให้ตรงกับ Constructor
    const user = await this.usersRepository.findOne({
      where: { primaryOrganizationId: organizationId },
      // order: { roleId: 'ASC' } // (Optional) Logic การเลือกคน
    });

    return user ? user.user_id : null;
  }

  // ฟังก์ชันดึงสิทธิ์ (Permission)
  async getUserPermissions(userId: number): Promise<string[]> {
    // Query ข้อมูลจาก View: v_user_all_permissions
    const permissions = await this.usersRepository.query(
      `SELECT permission_name FROM v_user_all_permissions WHERE user_id = ?`,
      [userId],
    );

    // แปลงผลลัพธ์เป็น Array ของ string ['user.create', 'project.view', ...]
    return permissions.map((row: any) => row.permission_name);
  }
}
