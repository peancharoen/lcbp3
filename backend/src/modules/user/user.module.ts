import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js'; // 1. Import Controller
import { User } from './entities/user.entity.js';
import { UserAssignmentService } from './user-assignment.service.js';
import { UserAssignment } from './entities/user-assignment.entity.js';

@Module({
  imports: [
    // 3. ลงทะเบียน Entity ทั้ง User และ UserAssignment
    TypeOrmModule.forFeature([User, UserAssignment]),
  ], // 2. เพิ่มบรรทัดนี้ เพื่อบอก NestJS ว่ามี Controller นี้อยู่
  controllers: [UserController],
  providers: [
    UserService,
    UserAssignmentService, // <--- 4. ลงทะเบียน Service เป็น Provider
  ],
  exports: [
    UserService,
    UserAssignmentService, // <--- 5. Export เผื่อที่อื่นใช้
  ], // Export ให้ AuthModule เรียกใช้ได้
})
export class UserModule {}
