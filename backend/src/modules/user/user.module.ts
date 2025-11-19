import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js'; // 1. Import Controller
import { User } from './entities/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // จดทะเบียน Entity
  // 2. เพิ่มบรรทัดนี้ เพื่อบอก NestJS ว่ามี Controller นี้อยู่
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export ให้ AuthModule เรียกใช้ได้
})
export class UserModule {}
