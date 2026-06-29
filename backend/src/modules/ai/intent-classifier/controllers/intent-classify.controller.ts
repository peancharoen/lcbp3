// File: src/modules/ai/intent-classifier/controllers/intent-classify.controller.ts
// Change Log
// - 2026-05-19: สร้าง Classification Controller (POST /ai/intent/classify) (ADR-024).

import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { IntentClassifierService } from '../services/intent-classifier.service';
import { ClassifyQueryDto } from '../dto/classify-query.dto';
import { ClassificationResult } from '../interfaces/classification-result.interface';

/**
 * Controller สำหรับ Intent Classification API
 * Route: POST /ai/intent/classify
 * Protected by JWT (ทุก authenticated user ใช้ได้)
 */
@Controller('ai/intent')
@UseGuards(JwtAuthGuard)
export class IntentClassifyController {
  private readonly logger = new Logger(IntentClassifyController.name);

  constructor(private readonly classifierService: IntentClassifierService) {}

  /** POST /ai/intent/classify — Classify user query → intent */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('classify')
  async classify(@Body() dto: ClassifyQueryDto): Promise<ClassificationResult> {
    this.logger.debug(`Classifying: "${dto.query}"`);
    return this.classifierService.classify({
      query: dto.query.trim(),
      projectPublicId: dto.projectPublicId,
      userPublicId: dto.userPublicId,
      currentDocumentId: dto.currentDocumentId,
    });
  }
}
