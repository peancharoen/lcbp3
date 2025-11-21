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
  Request, // <--- อย่าลืม Import Request
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AssignRoleDto } from './dto/assign-role.dto.js'; // <--- Import DTO
import { UserAssignmentService } from './user-assignment.service.js'; // <--- Import Service ใหม่

import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RbacGuard } from '../../common/auth/rbac.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly assignmentService: UserAssignmentService, // <--- ✅ Inject Service เข้ามา
  ) {}

  // --- User CRUD ---

  @Post()
  @RequirePermission('user.create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @RequirePermission('user.view')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @RequirePermission('user.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('user.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermission('user.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  // --- Role Assignment ---

  @Post('assign-role') // <--- ✅ ต้องมี @ เสมอครับ
  @RequirePermission('permission.assign')
  assignRole(@Body() dto: AssignRoleDto, @Request() req: any) {
    return this.assignmentService.assignRole(dto, req.user);
  }
}
