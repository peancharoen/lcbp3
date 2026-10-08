// File: backend/src/modules/organization/user-group.controller.ts
// Change Log:
// - 2026-10-06: Initial creation — endpoints สำหรับ user_groups + members (User Grouping Model)

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserGroupService } from './user-group.service';
import { CreateUserGroupDto, UpdateUserGroupDto } from './dto/user-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('User Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-groups')
export class UserGroupController {
  constructor(private readonly groupService: UserGroupService) {}

  @Post()
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create user group (org-scoped functional group)' })
  create(@Body() dto: CreateUserGroupDto) {
    return this.groupService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user groups (optional org filter)' })
  findAll(@Query('organization') orgPublicId?: string) {
    return this.groupService.findAllByOrg(orgPublicId);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get user group with members' })
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.groupService.findOne(uuid);
  }

  @Patch(':uuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update user group' })
  update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: UpdateUserGroupDto
  ) {
    return this.groupService.update(uuid, dto);
  }

  @Delete(':uuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Soft delete user group' })
  remove(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.groupService.remove(uuid);
  }

  @Post(':uuid/members/:userUuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Add member to group' })
  addMember(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('userUuid', ParseUuidPipe) userUuid: string
  ) {
    return this.groupService.addMember(uuid, userUuid);
  }

  @Delete(':uuid/members/:userUuid')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Remove member from group' })
  removeMember(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('userUuid', ParseUuidPipe) userUuid: string
  ) {
    return this.groupService.removeMember(uuid, userUuid);
  }
}
