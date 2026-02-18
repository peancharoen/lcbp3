import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { UserAssignmentService } from './user-assignment.service';
import { UserPreferenceService } from './user-preference.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BulkAssignmentDto } from './dto/bulk-assignment.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly assignmentService: UserAssignmentService,
    private readonly preferenceService: UserPreferenceService
  ) {}

  // --- User Preferences (Me) ---

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get my preferences' })
  @ApiResponse({ status: 200, description: 'User preferences' })
  @UseGuards(JwtAuthGuard)
  getMyPreferences(@CurrentUser() user: User) {
    return this.preferenceService.findByUser(user.user_id);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update my preferences' })
  @ApiBody({ type: UpdatePreferenceDto })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  @UseGuards(JwtAuthGuard)
  updateMyPreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferenceDto
  ) {
    return this.preferenceService.update(user.user_id, dto);
  }

  @Get('me/permissions')
  @ApiOperation({ summary: 'Get my permissions' })
  @ApiResponse({ status: 200, description: 'User permissions' })
  @UseGuards(JwtAuthGuard)
  getMyPermissions(@CurrentUser() user: User) {
    return this.userService.getUserPermissions(user.user_id);
  }

  // --- Reference Data (Roles/Permissions) ---

  @Get('roles')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  @RequirePermission('user.view')
  findAllRoles() {
    return this.userService.findAllRoles();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  @RequirePermission('user.view')
  findAllPermissions() {
    return this.userService.findAllPermissions();
  }

  @Patch('roles/:id/permissions')
  @RequirePermission('role.assign_permissions')
  @ApiOperation({ summary: 'Update role permissions' })
  async updateRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body('permissionIds') permissionIds: number[]
  ) {
    return this.userService.updateRolePermissions(id, permissionIds);
  }

  // --- User CRUD (Admin) ---

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created' })
  @RequirePermission('user.create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @RequirePermission('user.view')
  findAll(@Query() query: SearchUserDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @RequirePermission('user.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated' })
  @RequirePermission('user.edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Soft delete)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @RequirePermission('user.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  // --- Role Assignment ---

  @Post('assign-role')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiBody({ type: AssignRoleDto })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  @RequirePermission('user.manage_assignments')
  assignRole(@Body() dto: AssignRoleDto, @CurrentUser() user: User) {
    return this.assignmentService.assignRole(dto, user);
  }

  @Post('assignments/bulk')
  @ApiOperation({ summary: 'Bulk update user assignments' })
  @ApiBody({ type: BulkAssignmentDto })
  @ApiResponse({ status: 200, description: 'Assignments updated' })
  // @RequirePermission('user.manage_assignments')
  @RequirePermission('user.manage_assignments')
  bulkUpdateAssignments(
    @Body() dto: BulkAssignmentDto,
    @CurrentUser() user: User
  ) {
    return this.assignmentService.bulkUpdateAssignments(dto, user);
  }
}
