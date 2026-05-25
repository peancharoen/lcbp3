// File: backend/src/modules/ai/prompts/ai-prompts.controller.ts
// Change Log
// - 2026-05-25: Created AiPromptsController for dynamic prompt management (ADR-029)

import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AiPromptsService } from './ai-prompts.service';
import { AiPrompt } from './ai-prompts.entity';
import { CreateAiPromptDto } from './dto/create-ai-prompt.dto';
import { UpdatePromptNoteDto } from './dto/update-prompt-note.dto';
import { AiPromptResponseDto } from './dto/ai-prompt-response.dto';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Audit } from '../../../common/decorators/audit.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';

/**
 * Controller สำหรับจัดการ Prompt Versions ของ AI OCR (ADR-029)
 */
@ApiTags('AI Prompts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('ai/prompts')
export class AiPromptsController {
  constructor(private readonly promptsService: AiPromptsService) {}

  private mapToDto(prompt: AiPrompt): AiPromptResponseDto {
    return plainToInstance(AiPromptResponseDto, prompt, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':promptType')
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'ดึงรายการ Prompt Versions ทั้งหมดสำหรับ prompt_type ที่กำหนด',
  })
  @ApiParam({ name: 'promptType', example: 'ocr_extraction' })
  async listPromptVersions(
    @Param('promptType') promptType: string
  ): Promise<{ data: AiPromptResponseDto[] }> {
    const list = await this.promptsService.findAll(promptType);
    return { data: list.map((p) => this.mapToDto(p)) };
  }

  @Post(':promptType')
  @RequirePermission('system.manage_all')
  @Audit('ai_prompt.create', 'AiPrompt')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'สร้าง Prompt Version ใหม่ (เริ่มต้นเป็น inactive)',
  })
  @ApiParam({ name: 'promptType', example: 'ocr_extraction' })
  async createPromptVersion(
    @Param('promptType') promptType: string,
    @Body() dto: CreateAiPromptDto,
    @CurrentUser() user: User
  ): Promise<{ data: AiPromptResponseDto }> {
    const newPrompt = await this.promptsService.create(
      promptType,
      dto,
      user.user_id
    );
    return { data: this.mapToDto(newPrompt) };
  }

  @Delete(':promptType/:versionNumber')
  @RequirePermission('system.manage_all')
  @Audit('ai_prompt.delete', 'AiPrompt')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'ลบ Prompt Version (ห้ามลบ active version)' })
  @ApiParam({ name: 'promptType', example: 'ocr_extraction' })
  @ApiParam({ name: 'versionNumber', type: Number })
  async deletePromptVersion(
    @Param('promptType') promptType: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @CurrentUser() user: User
  ): Promise<void> {
    await this.promptsService.delete(promptType, versionNumber, user.user_id);
  }

  @Post(':promptType/:versionNumber/activate')
  @RequirePermission('system.manage_all')
  @Audit('ai_prompt.activate', 'AiPrompt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'เปิดใช้งาน Prompt Version' })
  @ApiParam({ name: 'promptType', example: 'ocr_extraction' })
  @ApiParam({ name: 'versionNumber', type: Number })
  async activatePromptVersion(
    @Param('promptType') promptType: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @CurrentUser() user: User
  ): Promise<{ data: AiPromptResponseDto }> {
    const activated = await this.promptsService.activate(
      promptType,
      versionNumber,
      user.user_id
    );
    return { data: this.mapToDto(activated) };
  }

  @Patch(':promptType/:versionNumber/note')
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'บันทึก Manual Note สำหรับ Prompt Version' })
  @ApiParam({ name: 'promptType', example: 'ocr_extraction' })
  @ApiParam({ name: 'versionNumber', type: Number })
  async updatePromptNote(
    @Param('promptType') promptType: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @Body() dto: UpdatePromptNoteDto
  ): Promise<{ data: AiPromptResponseDto }> {
    const updated = await this.promptsService.updateNote(
      promptType,
      versionNumber,
      dto.manualNote
    );
    return { data: this.mapToDto(updated) };
  }
}
