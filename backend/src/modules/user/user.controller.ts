import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { RbacGuard } from '../../common/auth/rbac.guard.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard) // 🔒 เพิ่ม RbacGuard ต่อท้าย) // 🔒 บังคับ Login ทุก Endpoints ในนี้
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 1. สร้างผู้ใช้ใหม่
  @Post()
  @RequirePermission('user.create') // 🔒 ต้องมีสิทธิ์ user.create ถึงจะเข้าได้
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // 2. ดูรายชื่อผู้ใช้ทั้งหมด
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  // 3. ดูข้อมูลผู้ใช้รายคน (ตาม ID)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  // 4. แก้ไขข้อมูลผู้ใช้
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  // 5. ลบผู้ใช้ (Soft Delete)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
