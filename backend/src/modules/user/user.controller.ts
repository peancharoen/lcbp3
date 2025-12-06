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
import { UpdatePreferenceDto } from './dto/update-preference.dto';

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
  findAll() {
    return this.userService.findAll();
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
  @RequirePermission('permission.assign')
  assignRole(@Body() dto: AssignRoleDto, @CurrentUser() user: User) {
    return this.assignmentService.assignRole(dto, user);
  }
}
