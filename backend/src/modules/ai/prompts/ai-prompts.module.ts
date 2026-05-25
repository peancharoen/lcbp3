// File: backend/src/modules/ai/prompts/ai-prompts.module.ts
// Change Log
// - 2026-05-25: Created AiPromptsModule for prompt versioning system (ADR-029)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPrompt } from './ai-prompts.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { AiPromptsService } from './ai-prompts.service';
import { AiPromptsController } from './ai-prompts.controller';

/**
 * Module สำหรับการจัดการเวอร์ชันของ AI Prompts ใน OCR Pipeline
 */
@Module({
  imports: [TypeOrmModule.forFeature([AiPrompt, AuditLog])],
  controllers: [AiPromptsController],
  providers: [AiPromptsService],
  exports: [AiPromptsService],
})
export class AiPromptsModule {}
