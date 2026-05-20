// File: src/modules/ai/intent-classifier/intent-classifier.module.ts
// Change Log
// - 2026-05-19: สร้าง NestJS Module สำหรับ Intent Classification System (ADR-024).

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { IntentDefinition } from './entities/intent-definition.entity';
import { IntentPattern } from './entities/intent-pattern.entity';
import { AiAuditLog } from '../entities/ai-audit-log.entity';
import { IntentPatternCacheService } from './services/intent-pattern-cache.service';
import { PatternMatcherService } from './services/pattern-matcher.service';
import { OllamaClientService } from './services/ollama-client.service';
import { LlmSemaphoreService } from './services/llm-semaphore.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { IntentDefinitionService } from './services/intent-definition.service';
import { IntentPatternService } from './services/intent-pattern.service';
import { ClassificationAuditService } from './services/classification-audit.service';
import { IntentAnalyticsService } from './services/intent-analytics.service';
import {
  IntentAdminController,
  IntentPatternAdminController,
} from './controllers/intent-admin.controller';
import { IntentClassifyController } from './controllers/intent-classify.controller';
import { IntentAnalyticsController } from './controllers/intent-analytics.controller';
import { UserModule } from '../../user/user.module';

/**
 * Module สำหรับ Intent Classification System
 * จัดการ entities, services, และ exports สำหรับ module อื่น
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([IntentDefinition, IntentPattern, AiAuditLog]),
    ConfigModule,
    RedisModule,
    UserModule,
  ],
  controllers: [
    IntentAdminController,
    IntentPatternAdminController,
    IntentClassifyController,
    IntentAnalyticsController,
  ],
  providers: [
    IntentPatternCacheService,
    PatternMatcherService,
    OllamaClientService,
    LlmSemaphoreService,
    IntentClassifierService,
    IntentDefinitionService,
    IntentPatternService,
    ClassificationAuditService,
    IntentAnalyticsService,
  ],
  exports: [
    IntentClassifierService,
    IntentDefinitionService,
    IntentPatternService,
  ],
})
export class IntentClassifierModule {}
