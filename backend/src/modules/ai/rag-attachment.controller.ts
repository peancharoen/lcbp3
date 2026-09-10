// File: backend/src/modules/ai/rag-attachment.controller.ts
// Change Log:
// - 2026-09-10: T027 update ingest endpoint ใช้ RagAttachmentIngestionService (Feature 254)
// - 2026-09-09: เพิ่ม endpoint สำหรับเริ่มและตรวจสถานะ RAG Attachment ingestion (Feature 254)
// - 2026-09-09: เพิ่ม query endpoint สำหรับ ACTIVE-generation retrieval (Feature 254)

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../common/decorators/audit.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ValidationException } from '../../common/exceptions';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AiQueueService } from './ai-queue.service';
import {
  RagAttachmentIngestDto,
  RagAttachmentQueryDto,
  RagClassificationOverrideDto,
} from './dto/rag-attachment.dto';
import { RagClassificationService } from './services/rag-classification.service';
import { RagGenerationService } from './services/rag-generation.service';
import { RagAttachmentIngestionService } from './services/rag-attachment-ingestion.service';
import { RagRetrievalService } from './services/rag-retrieval.service';
import { OcrService } from './services/ocr.service';

/** Controller สำหรับ RAG Attachment generation lifecycle */
@ApiTags('AI RAG Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('ai/rag/attachments')
export class RagAttachmentController {
  constructor(
    private readonly generationService: RagGenerationService,
    private readonly ingestionService: RagAttachmentIngestionService,
    private readonly retrievalService: RagRetrievalService,
    private readonly ocrService: OcrService,
    private readonly aiQueueService: AiQueueService,
    @Optional()
    private readonly classificationService?: RagClassificationService
  ) {}

  /** เริ่มสร้าง generation ใหม่แบบ asynchronous */
  @Post(':attachmentPublicId/ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('rag.manage')
  @Audit('rag.attachment.ingest', 'rag_attachment')
  @ApiOperation({ summary: 'Start RAG ingestion for an Attachment' })
  public async ingest(
    @Param('attachmentPublicId', ParseUuidPipe) attachmentPublicId: string,
    @Body() dto: RagAttachmentIngestDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<{
    attachmentPublicId: string;
    status: 'BUILDING' | 'ACTIVE';
    jobId: string;
  }> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new ValidationException('Idempotency-Key header is required', [
        {
          field: 'Idempotency-Key',
          message: 'ต้องระบุ Idempotency-Key header',
        },
      ]);
    }
    const generation = await this.ingestionService.ingest(
      attachmentPublicId,
      dto.force ?? false
    );
    const jobId = await this.aiQueueService.enqueueRagAttachmentIngestion({
      attachmentPublicId,
      attachmentChecksum: generation.attachmentChecksumSnapshot,
      force: dto.force ?? false,
    });
    return {
      attachmentPublicId,
      status: generation.status === 'ACTIVE' ? 'ACTIVE' : 'BUILDING',
      jobId,
    };
  }

  /** คืนสถานะ ingestion ล่าสุดโดยไม่เปิดเผย generation UUID */
  @Get(':attachmentPublicId/status')
  @RequirePermission('rag.manage')
  @ApiOperation({ summary: 'Get RAG ingestion status for an Attachment' })
  public async status(
    @Param('attachmentPublicId', ParseUuidPipe) attachmentPublicId: string
  ): Promise<{
    attachmentPublicId: string;
    status: string;
    chunkCount: number;
    indexedAt?: Date;
    lastError?: string;
  }> {
    return this.generationService.getStatus(attachmentPublicId);
  }

  /** ค้นหา RAG ด้วย query text บังคับ project scope และ ACTIVE generation */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rag.manage')
  @Audit('rag.attachment.query', 'rag_attachment')
  @ApiOperation({ summary: 'Query RAG with project-scoped ACTIVE generation' })
  public async query(@Body() dto: RagAttachmentQueryDto): Promise<{
    projectPublicId: string;
    citations: Array<{
      chunkPublicId: string;
      attachmentPublicId: string;
      ownerType: string;
      ownerPublicId: string;
      content: string;
      segmentType: 'PAGE' | 'SECTION' | 'SHEET' | 'WHOLE_DOCUMENT';
      segmentNumber?: number;
      segmentLabel?: string;
      sourceLocator?: string;
      score: number;
    }>;
    totalFound: number;
    skippedStale: number;
  }> {
    const embedResult = await this.ocrService.embedViaSidecar(dto.query);
    const result = await this.retrievalService.retrieve(
      dto.projectPublicId,
      embedResult.dense,
      dto.topK ?? 10
    );
    return {
      projectPublicId: dto.projectPublicId,
      citations: result.citations,
      totalFound: result.totalFound,
      skippedStale: result.skippedStale,
    };
  }

  /** เปลี่ยน classification ของ Attachment (Superadmin only) */
  @Patch(':attachmentPublicId/classification')
  @RequirePermission('document.classification_override')
  @Audit('rag.attachment.classification_override', 'rag_attachment')
  @ApiOperation({ summary: 'Override Attachment classification (Superadmin)' })
  public async overrideClassification(
    @Param('attachmentPublicId', ParseUuidPipe) attachmentPublicId: string,
    @Body() dto: RagClassificationOverrideDto,
    @Req() req: RequestWithUser
  ): Promise<{
    attachmentPublicId: string;
    classification: string;
  }> {
    // ถ้ามี RagClassificationService (production) ใช้ CASL + audit + async Qdrant sync
    // ถ้าไม่มี (test/fallback) ใช้ RagGenerationService โดยตรง
    if (this.classificationService) {
      await this.classificationService.overrideClassification({
        attachmentPublicId,
        newClassification: dto.classification,
        reason: dto.reason ?? '',
        user: req.user,
      });
    } else {
      await this.generationService.overrideClassification(
        attachmentPublicId,
        dto.classification
      );
    }
    return {
      attachmentPublicId,
      classification: dto.classification,
    };
  }
}
