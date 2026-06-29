// File: src/modules/ai/intent-classifier/controllers/intent-admin.controller.ts
// Change Log
// - 2026-05-19: สร้าง Admin Controller สำหรับจัดการ Intent Definitions/Patterns (ADR-024).

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { Audit } from '../../../../common/decorators/audit.decorator';
import { IntentDefinitionService } from '../services/intent-definition.service';
import { IntentPatternService } from '../services/intent-pattern.service';
import { CreateIntentDefinitionDto } from '../dto/create-intent-definition.dto';
import { UpdateIntentDefinitionDto } from '../dto/update-intent-definition.dto';
import { CreateIntentPatternDto } from '../dto/create-intent-pattern.dto';
import { UpdateIntentPatternDto } from '../dto/update-intent-pattern.dto';
import { IntentCategory } from '../interfaces/intent-category.enum';

/**
 * Admin Controller สำหรับจัดการ Intent Definitions และ Patterns
 * Route prefix: /admin/ai/intent-definitions
 * Protected by JwtAuthGuard + RbacGuard (system admin only)
 */
@Controller('admin/ai/intent-definitions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class IntentAdminController {
  private readonly logger = new Logger(IntentAdminController.name);

  constructor(
    private readonly definitionService: IntentDefinitionService,
    private readonly patternService: IntentPatternService
  ) {}

  // ===== Intent Definitions =====

  /** GET /admin/ai/intent-definitions — ดึงรายการ Intent Definitions */
  @Get()
  async findAll(
    @Query('category') category?: IntentCategory,
    @Query('isActive') isActive?: string
  ) {
    const filter = {
      category,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    };
    const data = await this.definitionService.findAll(filter);
    return { data };
  }

  /** GET /admin/ai/intent-definitions/:intentCode — ดึงตาม intentCode */
  @Get(':intentCode')
  async findOne(@Param('intentCode') intentCode: string) {
    return this.definitionService.findByCode(intentCode);
  }

  /** POST /admin/ai/intent-definitions — สร้าง Intent Definition ใหม่ */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audit('intent-definition.create', 'IntentDefinition')
  async create(@Body() dto: CreateIntentDefinitionDto) {
    return this.definitionService.create(dto);
  }

  /** PATCH /admin/ai/intent-definitions/:intentCode — อัปเดต */
  @Patch(':intentCode')
  @Audit('intent-definition.update', 'IntentDefinition')
  async update(
    @Param('intentCode') intentCode: string,
    @Body() dto: UpdateIntentDefinitionDto
  ) {
    return this.definitionService.update(intentCode, dto);
  }

  // ===== Intent Patterns =====

  /** GET /admin/ai/intent-definitions/:intentCode/patterns — ดึง Patterns */
  @Get(':intentCode/patterns')
  async findPatterns(@Param('intentCode') intentCode: string) {
    const data = await this.patternService.findByIntentCode(intentCode);
    return { data };
  }

  /** POST /admin/ai/intent-definitions/:intentCode/patterns — สร้าง Pattern */
  @Post(':intentCode/patterns')
  @HttpCode(HttpStatus.CREATED)
  @Audit('intent-pattern.create', 'IntentPattern')
  async createPattern(
    @Param('intentCode') intentCode: string,
    @Body() dto: CreateIntentPatternDto
  ) {
    return this.patternService.create({
      intentCode,
      ...dto,
    });
  }
}

/**
 * Admin Controller สำหรับจัดการ Pattern โดย publicId
 * Route prefix: /admin/ai/intent-patterns
 */
@Controller('admin/ai/intent-patterns')
@UseGuards(JwtAuthGuard, RbacGuard)
export class IntentPatternAdminController {
  private readonly logger = new Logger(IntentPatternAdminController.name);

  constructor(private readonly patternService: IntentPatternService) {}

  /** GET /admin/ai/intent-patterns/:publicId — ดึง Pattern ตาม publicId */
  @Get(':publicId')
  async findOne(@Param('publicId') publicId: string) {
    return this.patternService.findByPublicId(publicId);
  }

  /** PATCH /admin/ai/intent-patterns/:publicId — อัปเดต Pattern */
  @Patch(':publicId')
  @Audit('intent-pattern.update', 'IntentPattern')
  async update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateIntentPatternDto
  ) {
    return this.patternService.update(publicId, dto);
  }

  /** DELETE /admin/ai/intent-patterns/:publicId — Soft delete Pattern */
  @Delete(':publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('intent-pattern.delete', 'IntentPattern')
  async remove(@Param('publicId') publicId: string) {
    await this.patternService.remove(publicId);
  }
}
