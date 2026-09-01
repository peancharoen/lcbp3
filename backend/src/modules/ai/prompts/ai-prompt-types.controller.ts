// File: backend/src/modules/ai/prompts/ai-prompt-types.controller.ts
// Change Log:
// - 2026-09-01: Created AiPromptTypesController for master prompt types (Feature 251)

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Audit } from '../../../common/decorators/audit.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';
import { AiPromptTypesService } from './ai-prompt-types.service';
import { CreateAiPromptTypeDto } from './dto/create-ai-prompt-type.dto';
import { AiPromptTypeResponseDto } from './dto/ai-prompt-type-response.dto';
import { ValidationException } from '../../../common/exceptions';

/**
 * Controller สำหรับจัดการ ai_prompt_types master table (Feature 251)
 */
@ApiTags('AI Prompt Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('ai/prompt-types')
export class AiPromptTypesController {
  constructor(private readonly promptTypesService: AiPromptTypesService) {}

  private assertIdempotencyKey(idempotencyKey?: string): void {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }
  }

  @Get()
  @RequirePermission('ai.prompt.manage')
  @ApiOperation({
    summary: 'ดึงรายการ prompt types ทั้งหมดที่ active',
  })
  async listPromptTypes(): Promise<{ data: AiPromptTypeResponseDto[] }> {
    const list = await this.promptTypesService.findAll();
    return { data: list };
  }

  @Post()
  @RequirePermission('system.manage_all')
  @Audit('ai_prompt_type.create', 'AiPromptType')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'สร้าง prompt type ใหม่ (super-admin only)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'ADR-016: Idempotency key สำหรับทุก POST/PUT/PATCH',
  })
  async createPromptType(
    @Body() dto: CreateAiPromptTypeDto,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKey: string
  ): Promise<AiPromptTypeResponseDto> {
    this.assertIdempotencyKey(idempotencyKey);
    return this.promptTypesService.create(dto, user.user_id);
  }

  @Delete(':promptType')
  @RequirePermission('system.manage_all')
  @Audit('ai_prompt_type.delete', 'AiPromptType')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'ลบ prompt type (super-admin only)',
  })
  async deletePromptType(
    @Param('promptType') promptType: string
  ): Promise<void> {
    await this.promptTypesService.delete(promptType);
  }
}
