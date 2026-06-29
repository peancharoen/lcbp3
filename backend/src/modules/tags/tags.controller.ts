// File: src/modules/tags/tags.controller.ts
// Change Log:
// - 2026-05-22: เริ่มต้นสร้าง TagsController สำหรับจัดการ Endpoint ของแท็กตาม ADR-028

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

/**
 * คอนโทรลเลอร์สำหรับจัดการแท็กโครงการและแท็กระบบ
 */
@ApiTags('Tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('tags')
export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /**
   * สร้างแท็กใหม่ภายใต้สิทธิ์ tag.create
   */
  @Post()
  @ApiOperation({ summary: 'Create new tag' })
  @RequirePermission('tag.create')
  async create(
    @Body() createDto: CreateTagDto,
    @Request() req: RequestWithUser
  ) {
    const resolvedProjectId = createDto.projectId
      ? await this.uuidResolver.resolveProjectId(createDto.projectId)
      : null;
    return this.tagsService.create({
      projectId: resolvedProjectId,
      tagName: createDto.tagName,
      colorCode: createDto.colorCode,
      description: createDto.description,
      createdBy: req.user.user_id,
    });
  }

  /**
   * ค้นหาแท็กทั้งหมดตาม Project ID (UUID) ภายใต้สิทธิ์ tag.view
   */
  @Get()
  @ApiOperation({ summary: 'Get tags by project' })
  @RequirePermission('tag.view')
  async findByProject(@Query('projectId') projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.uuidResolver.resolveProjectId(projectId)
      : null;
    return this.tagsService.findByProject(resolvedProjectId);
  }
}
