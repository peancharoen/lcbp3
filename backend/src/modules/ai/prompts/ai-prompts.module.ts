// File: backend/src/modules/ai/prompts/ai-prompts.module.ts
// Change Log
// - 2026-05-25: Created AiPromptsModule for prompt versioning system (ADR-029)
// - 2026-05-26: Import UserModule to resolve RbacGuard dependency (UserService)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPrompt } from './ai-prompts.entity';
import { AiPromptType } from './ai-prompt-types.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { AiPromptsService } from './ai-prompts.service';
import { AiPromptTypesService } from './ai-prompt-types.service';
import { AiPromptsController } from './ai-prompts.controller';
import { AiPromptTypesController } from './ai-prompt-types.controller';
import { UserModule } from '../../user/user.module';

/**
 * Module สำหรับการจัดการเวอร์ชันของ AI Prompts ใน OCR Pipeline
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AiPrompt, AiPromptType, AuditLog]),
    UserModule,
  ],
  controllers: [AiPromptsController, AiPromptTypesController],
  providers: [AiPromptsService, AiPromptTypesService],
  exports: [AiPromptsService, AiPromptTypesService],
})
export class AiPromptsModule {}
