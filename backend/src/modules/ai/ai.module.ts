// File: src/modules/ai/ai.module.ts
// Module สำหรับ AI Gateway — ลงทะเบียน Services และ Controllers (ADR-018, ADR-020)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiValidationService } from './ai-validation.service';
import { MigrationLog } from './entities/migration-log.entity';
import { AiAuditLog } from './entities/ai-audit-log.entity';
import { UserModule } from '../user/user.module';
import { RbacGuard } from '../../common/guards/rbac.guard';

@Module({
  imports: [
    // Entities สำหรับ AI Module
    TypeOrmModule.forFeature([MigrationLog, AiAuditLog]),

    // HTTP Client สำหรับเรียก n8n Webhook (ADR-018: AI สื่อสารผ่าน API)
    HttpModule.register({
      timeout: 35000, // เผื่อ timeout เกิน AI_TIMEOUT_MS เล็กน้อย
      maxRedirects: 3,
    }),

    // Config สำหรับ AI Env Vars
    ConfigModule,

    // UserModule สำหรับ RbacGuard (ต้องการ UserService)
    UserModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiValidationService,
    // RbacGuard ต้องการ UserService จาก UserModule
    RbacGuard,
  ],
  exports: [AiService, AiValidationService],
})
export class AiModule {}
