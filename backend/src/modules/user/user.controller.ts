// File: src/modules/user/user.controller.ts
// บันทึกการแก้ไข: เพิ่ม Endpoints สำหรับ User Preferences (T1.3)

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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { UserService } from './user.service';
import { UserAssignmentService } from './user-assignment.service';
import { UserPreferenceService } from './user-preference.service'; // ✅ เพิ่ม
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto'; // ✅ เพิ่ม DTO

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard'; // สมมติว่ามีแล้ว ถ้ายังไม่มีให้คอมเมนต์ไว้ก่อน
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard) // RbacGuard จะเช็ค permission
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly assignmentService: UserAssignmentService,
    private readonly preferenceService: UserPreferenceService, // ✅ Inject Service
  ) {}

  // --- User Preferences (Me) ---
  // ต้องวางไว้ก่อน :id เพื่อไม่ให้ route ชนกัน

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get my preferences' })
  @UseGuards(JwtAuthGuard) // Bypass RBAC check for self
  getMyPreferences(@CurrentUser() user: User) {
    return this.preferenceService.findByUser(user.user_id);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update my preferences' })
  @UseGuards(JwtAuthGuard) // Bypass RBAC check for self
  updateMyPreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.preferenceService.update(user.user_id, dto);
  }

  @Get('me/permissions')
  @ApiOperation({ summary: 'Get my permissions' })
  @UseGuards(JwtAuthGuard)
  getMyPermissions(@CurrentUser() user: User) {
    return this.userService.getUserPermissions(user.user_id);
  }

  // --- User CRUD (Admin) ---

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @RequirePermission('user.create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @RequirePermission('user.view')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  @RequirePermission('user.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @RequirePermission('user.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Soft delete)' })
  @RequirePermission('user.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  // --- Role Assignment ---

  @Post('assign-role')
  @ApiOperation({ summary: 'Assign role to user' })
  @RequirePermission('permission.assign')
  assignRole(@Body() dto: AssignRoleDto, @CurrentUser() user: User) {
    return this.assignmentService.assignRole(dto, user);
  }
}
