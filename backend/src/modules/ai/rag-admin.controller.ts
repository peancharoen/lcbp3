// File: backend/src/modules/ai/rag-admin.controller.ts
// Change Log:
// - 2026-09-10: T010 — สร้าง RagAdminController สำหรับ Feature 255 RAG Admin Console (8 endpoints)

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../common/decorators/audit.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { ValidationException } from '../../common/exceptions';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import {
  RagAdminBatchRetryDto,
  RagAdminClassificationListDto,
  RagAdminFailedIngestionsDto,
  RagAdminListAttachmentsDto,
  RagAdminAttachmentsResponseDto,
  RagAdminClassificationListResponseDto,
  RagAdminGenerationsResponseDto,
  RagAdminFailedIngestionsResponseDto,
  RagAdminBatchRetryResponseDto,
  RagAdminReingestResponseDto,
  RagAdminMetricsResetResponseDto,
} from './dto/rag-admin.dto';
import type { RagAdminMetricsSnapshotDto } from './dto/rag-admin.dto';
import { RagAdminService } from './services/rag-admin.service';
import { RagObservabilityService } from './services/rag-observability.service';
import { RagAttachmentIngestionService } from './services/rag-attachment-ingestion.service';

/**
 * Controller สำหรับ RAG Admin Console (Feature 255)
 * แยกจาก RagAttachmentController เพื่อ separation of concerns (admin vs operational — Q2)
 * Route prefix: `ai/admin/rag/...` ตาม dominant pattern `ai/admin/...` ของ AiController (Q1)
 *
 * Guards:
 * - Controller-level: JwtAuthGuard + RbacGuard (ทุก endpoint ต้องผ่าน auth + RBAC)
 * - Method-level AiEnabledGuard: เฉพาะ operations ที่ enqueue BullMQ (reingest, retry) — Q4
 *   ไม่ใส่บน read-only หรือ metrics reset (pure in-memory)
 */
@ApiTags('AI RAG Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('ai/admin/rag')
export class RagAdminController {
  private readonly logger = new Logger(RagAdminController.name);

  constructor(
    private readonly ragAdminService: RagAdminService,
    private readonly observabilityService: RagObservabilityService,
    private readonly ingestionService: RagAttachmentIngestionService
  ) {}

  /** GET /ai/admin/rag/attachments — dashboard list (US1) */
  @Get('attachments')
  @RequirePermission('rag.manage')
  @ApiOperation({ summary: 'List attachments with RAG ingestion status' })
  public async listAttachments(
    @Query() dto: RagAdminListAttachmentsDto
  ): Promise<RagAdminAttachmentsResponseDto> {
    return this.ragAdminService.listAttachments(dto);
  }

  /** GET /ai/admin/rag/attachments/classification — classification list (US2, Q43) */
  @Get('attachments/classification')
  @RequirePermission('rag.manage')
  @ApiOperation({
    summary: 'List attachments with classification + override info',
  })
  public async listAttachmentsForClassification(
    @Query() dto: RagAdminClassificationListDto
  ): Promise<RagAdminClassificationListResponseDto> {
    return this.ragAdminService.listAttachmentsForClassification(dto);
  }

  /** GET /ai/admin/rag/attachments/:attachmentPublicId/generations — lifecycle (US3) */
  @Get('attachments/:attachmentPublicId/generations')
  @RequirePermission('rag.manage')
  @ApiOperation({
    summary: 'List generation lifecycle history for an attachment',
  })
  public async listGenerations(
    @Param('attachmentPublicId', ParseUuidPipe) attachmentPublicId: string
  ): Promise<RagAdminGenerationsResponseDto> {
    return this.ragAdminService.listGenerations(attachmentPublicId);
  }

  /** POST /ai/admin/rag/attachments/:attachmentPublicId/reingest — force re-ingest (US3, Q12) */
  @Post('attachments/:attachmentPublicId/reingest')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('rag.admin.write')
  @UseGuards(AiEnabledGuard)
  @Audit('rag.admin.reingest', 'rag_attachment')
  @ApiOperation({ summary: 'Force re-ingest an attachment (409 if BUILDING)' })
  public async reingest(
    @Param('attachmentPublicId', ParseUuidPipe) attachmentPublicId: string,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<RagAdminReingestResponseDto> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new ValidationException('Idempotency-Key header is required', [
        {
          field: 'Idempotency-Key',
          message: 'ต้องระบุ Idempotency-Key header',
        },
      ]);
    }
    return this.ragAdminService.reingest(attachmentPublicId);
  }

  /** GET /ai/admin/rag/metrics — metrics snapshot (US4) */
  @Get('metrics')
  @RequirePermission('rag.manage')
  @ApiOperation({ summary: 'Get RAG observability metrics snapshot' })
  public getMetrics(): RagAdminMetricsSnapshotDto {
    try {
      return this.observabilityService.getSnapshot() as unknown as RagAdminMetricsSnapshotDto;
    } catch (err) {
      // FR-018: คืน zero-value snapshot เมื่อ observability service ไม่พร้อม ไม่ throw 500
      this.logger.error(
        `getMetrics: observability service unavailable — ${(err as Error).message}`
      );
      return {
        swap: {
          started: 0,
          completed: 0,
          rolledBack: 0,
          activeConcurrent: 0,
          maxConcurrent: 0,
        },
        qdrantDeletion: {
          attempted: 0,
          succeeded: 0,
          partialFailures: 0,
          totalPendingRetries: 0,
        },
        cleanup: { processed: 0, succeeded: 0, failed: 0, durationMs: 0 },
        ingestionDuration: {
          count: 0,
          sumMs: 0,
          buckets: { 100: 0, 500: 0, 2000: 0 },
        },
        chunkCount: { total: 0, ingestionCount: 0 },
        vectorLatency: {
          count: 0,
          sumMs: 0,
          buckets: { 100: 0, 500: 0, 2000: 0 },
        },
        staleResultRate: { stale: 0, total: 0 },
        fallbackRate: { fullTextFallback: 0, totalQueries: 0 },
        cleanupRetryRate: { retries: 0, cleanups: 0 },
        uptimeMs: 0,
      } as unknown as RagAdminMetricsSnapshotDto;
    }
  }

  /** POST /ai/admin/rag/metrics/reset — global reset (US4, Q15) */
  @Post('metrics/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rag.admin.write')
  @Audit('rag.admin.metrics_reset', 'rag_observability')
  @ApiOperation({ summary: 'Reset RAG metrics globally (no per-project)' })
  public resetMetrics(): RagAdminMetricsResetResponseDto {
    this.observabilityService.reset();
    return { reset: true, scope: 'global' };
  }

  /** GET /ai/admin/rag/failed-ingestions — 2 sections (US5, Q31) */
  @Get('failed-ingestions')
  @RequirePermission('rag.manage')
  @ApiOperation({
    summary: 'List failed ingestions (RAG failures + AI pipeline failures)',
  })
  public async listFailedIngestions(
    @Query() dto: RagAdminFailedIngestionsDto
  ): Promise<RagAdminFailedIngestionsResponseDto> {
    return this.ragAdminService.listFailedIngestions(dto);
  }

  /** POST /ai/admin/rag/failed-ingestions/retry — batch retry (US5, Q17) */
  @Post('failed-ingestions/retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rag.retry')
  @UseGuards(AiEnabledGuard)
  @Audit('rag.admin.batch_retry', 'rag_attachment')
  @ApiOperation({
    summary: 'Batch retry failed ingestions (max 50, partial-success)',
  })
  public async batchRetry(
    @Body() dto: RagAdminBatchRetryDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<RagAdminBatchRetryResponseDto> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new ValidationException('Idempotency-Key header is required', [
        {
          field: 'Idempotency-Key',
          message: 'ต้องระบุ Idempotency-Key header',
        },
      ]);
    }
    return this.ragAdminService.batchRetry(dto.attachmentPublicIds);
  }
}
