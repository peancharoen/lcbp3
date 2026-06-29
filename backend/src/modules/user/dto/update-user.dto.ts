// File: src/modules/user/dto/update-user.dto.ts
// บันทึกการแก้ไข: ใช้ PartialType จาก @nestjs/swagger เพื่อรองรับ API Docs (T1.3)

import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
