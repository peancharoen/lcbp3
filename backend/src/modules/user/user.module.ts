// File: src/modules/user/user.module.ts
// บันทึกการแก้ไข: รวม UserPreferenceService และ RoleService (T1.3)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserAssignmentService } from './user-assignment.service';
import { UserPreferenceService } from './user-preference.service'; // ✅ เพิ่ม

// Entities
import { User } from './entities/user.entity';
import { UserAssignment } from './entities/user-assignment.entity';
import { UserPreference } from './entities/user-preference.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

@Module({
  imports: [
    // ลงทะเบียน Entity ให้ครบ
    TypeOrmModule.forFeature([
      User,
      UserAssignment,
      UserPreference,
      Role,
      Permission,
    ]),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserAssignmentService,
    UserPreferenceService, // ✅ เพิ่ม Provider
  ],
  exports: [
    UserService,
    UserAssignmentService,
    UserPreferenceService, // ✅ Export ให้ Module อื่นใช้ (เช่น Notification)
  ],
})
export class UserModule {}
