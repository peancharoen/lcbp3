// File: backend/src/modules/ai/services/rag-admin.service.ts
// Change Log:
// - 2026-09-10: T011 — สร้าง RagAdminService สำหรับ Feature 255 RAG Admin Console

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../../common/exceptions';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import {
  RagAdminListAttachmentsDto,
  RagAdminClassificationListDto,
  RagAdminFailedIngestionsDto,
  RagAdminPageSize,
  RagAdminStatusFilter,
  RagAdminAttachmentsResponseDto,
  RagAdminAttachmentItem,
  RagAdminClassificationListResponseDto,
  RagAdminClassificationItem,
  RagAdminGenerationsResponseDto,
  RagAdminGenerationItem,
  RagAdminFailedIngestionsResponseDto,
  RagAdminFailureItem,
  AiPipelineFailureItem,
  RagAdminBatchRetryResponseDto,
  BatchRetrySuccessItem,
  BatchRetryFailedItem,
  RagAdminReingestResponseDto,
  ClassificationOverrideInfo,
  SecurityClassification,
  AiProcessingStatus,
} from '../dto/rag-admin.dto';
import { RagAttachmentIngestionService } from './rag-attachment-ingestion.service';
import { AiQueueService } from '../ai-queue.service';

/** Raw query result สำหรับ listAttachments (dashboard) */
interface RawAttachmentRow {
  attachmentPublicId: string;
  originalFilename: string;
  mimeType: string;
  aiProcessingStatus: string;
  generationStatus: string | null;
  generationUuid: string | null;
  createdAt: Date | null;
  lastUpdated: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  chunkCount: number | null;
  effectiveClassification: string | null;
  overrideReason: string | null;
  overrideActor: string | null;
  overrideAt: Date | null;
}

/** Raw query result สำหรับ listAttachmentsForClassification */
interface RawClassificationRow {
  attachmentPublicId: string;
  originalFilename: string;
  effectiveClassification: string | null;
  overrideReason: string | null;
  overrideActor: string | null;
  overrideAt: Date | null;
}

/** Raw query result สำหรับ RAG failures (failed-ingestions) */
interface RawRagFailureRow {
  attachmentPublicId: string;
  originalFilename: string;
  errorCode: string | null;
  errorMessage: string | null;
  failedAt: Date | null;
}

/** Raw query result สำหรับ AI pipeline failures */
interface RawAiPipelineFailureRow {
  attachmentPublicId: string;
  originalFilename: string;
  aiProcessingStatus: string;
}

/** Raw query result สำหรับ chunk count aggregation */
interface RawChunkCountRow {
  generationUuid: string;
  chunkCount: number;
}

/**
 * Service สำหรับ RAG Admin Console (Feature 255)
 * แยกจาก RagAttachmentController เพื่อ separation of concerns (admin vs operational — Q2)
 * ครอบคลุม: list/aggregate/metrics/retry operations
 */
@Injectable()
export class RagAdminService {
  private readonly logger = new Logger(RagAdminService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    private readonly ingestionService: RagAttachmentIngestionService,
    private readonly aiQueueService: AiQueueService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * List attachments พร้อม RAG ingestion status (US1 Dashboard)
   * - Left join attachments + rag_attachment_generations (latest per attachment ด้วย ROW_NUMBER)
   * - Grouped chunk count
   * - classificationOverride จาก audit log
   * - ragStatus computed on-the-fly (NOT_STARTED ถ้าไม่มี generation — Q9)
   */
  public async listAttachments(
    dto: RagAdminListAttachmentsDto
  ): Promise<RagAdminAttachmentsResponseDto> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? RagAdminPageSize.TWENTY;
    const offset = (page - 1) * pageSize;

    // Query หลัก: attachments + latest generation (ROW_NUMBER window function, Q9)
    const qb = this.attachmentRepository
      .createQueryBuilder('a')
      .leftJoin(
        (subq) =>
          subq
            .select([
              'g.attachment_uuid AS attachmentUuid',
              'g.status AS generationStatus',
              'g.generation_uuid AS generationUuid',
              'g.created_at AS createdAt',
              'g.failed_at AS failedAt',
              'g.error_code AS errorCode',
              'g.error_message AS errorMessage',
              'ROW_NUMBER() OVER (PARTITION BY g.attachment_uuid ORDER BY g.created_at DESC) AS rn',
            ])
            .from(RagAttachmentGeneration, 'g'),
        'latest',
        'latest.attachmentUuid = a.publicId AND latest.rn = 1'
      )
      .leftJoin(
        (subq) =>
          subq
            .select(
              'c.generation_uuid AS generationUuid, COUNT(*) AS chunkCount'
            )
            .from(RagAttachmentChunk, 'c')
            .groupBy('c.generation_uuid'),
        'chunks',
        'chunks.generationUuid = latest.generationUuid'
      )
      .select([
        'a.publicId AS attachmentPublicId',
        'a.originalFilename AS originalFilename',
        'a.mimeType AS mimeType',
        'a.aiProcessingStatus AS aiProcessingStatus',
        'a.effectiveClassification AS effectiveClassification',
        'a.classificationOverrideReason AS overrideReason',
        'a.classificationOverrideActorUserPublicId AS overrideActor',
        'a.classificationOverriddenAt AS overrideAt',
        'latest.generationStatus AS generationStatus',
        'latest.createdAt AS lastUpdated',
        'latest.errorCode AS errorCode',
        'latest.errorMessage AS errorMessage',
        'COALESCE(chunks.chunkCount, 0) AS chunkCount',
      ]);

    if (dto.status) {
      if (dto.status === RagAdminStatusFilter.NOT_STARTED) {
        // NOT_STARTED = no generation exists (Q9 — LEFT JOIN WHERE generationUuid IS NULL)
        qb.andWhere('latest.generationUuid IS NULL');
      } else {
        qb.andWhere('latest.generationStatus = :status', {
          status: dto.status,
        });
      }
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize)
      .getRawMany<RawAttachmentRow>();

    const items: RagAdminAttachmentItem[] = rows.map((r) => {
      const ragStatus = (r.generationStatus ??
        RagAdminStatusFilter.NOT_STARTED) as RagAdminStatusFilter;
      const overrideInfo: ClassificationOverrideInfo | null =
        r.overrideReason != null
          ? {
              reason: r.overrideReason,
              overriddenBy: r.overrideActor ?? '',
              overriddenAt: r.overrideAt ?? new Date(),
            }
          : null;
      return {
        attachmentPublicId: r.attachmentPublicId,
        originalFilename: r.originalFilename,
        mimeType: r.mimeType,
        ragStatus,
        aiProcessingStatus: r.aiProcessingStatus as AiProcessingStatus,
        chunkCount: Number(r.chunkCount ?? 0),
        effectiveClassification:
          r.effectiveClassification as SecurityClassification,
        classificationOverride: overrideInfo,
        lastUpdated: r.lastUpdated ?? r.createdAt ?? new Date(),
        errorMessage: r.errorMessage,
      };
    });

    return { items, total, page, pageSize };
  }

  /**
   * List attachments สำหรับ Classification tab (US2, Q43)
   * - Separate query จาก dashboard (joins audit log สำหรับ override info)
   * - แสดงทุก attachment (ไม่ใช่เฉพาะที่ override — Q42)
   */
  public async listAttachmentsForClassification(
    dto: RagAdminClassificationListDto
  ): Promise<RagAdminClassificationListResponseDto> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? RagAdminPageSize.TWENTY;
    const offset = (page - 1) * pageSize;

    const qb = this.attachmentRepository
      .createQueryBuilder('a')
      .select([
        'a.publicId AS attachmentPublicId',
        'a.originalFilename AS originalFilename',
        'a.effectiveClassification AS effectiveClassification',
        'a.classificationOverrideReason AS overrideReason',
        'a.classificationOverrideActorUserPublicId AS overrideActor',
        'a.classificationOverriddenAt AS overrideAt',
      ]);

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize)
      .getRawMany<RawClassificationRow>();

    const items: RagAdminClassificationItem[] = rows.map((r) => {
      const overrideInfo: ClassificationOverrideInfo | null =
        r.overrideReason != null
          ? {
              reason: r.overrideReason,
              overriddenBy: r.overrideActor ?? '',
              overriddenAt: r.overrideAt ?? new Date(),
            }
          : null;
      return {
        attachmentPublicId: r.attachmentPublicId,
        originalFilename: r.originalFilename,
        effectiveClassification:
          r.effectiveClassification as SecurityClassification,
        classificationOverride: overrideInfo,
      };
    });

    return { items, total, page, pageSize };
  }

  /**
   * List generation lifecycle history สำหรับ attachment (US3, Q25)
   * - Ordered by createdAt DESC
   * - chunkCount via grouped COUNT(*) (Q26)
   * - MUST NOT expose internal generationUuid (FR-014)
   */
  public async listGenerations(
    attachmentPublicId: string
  ): Promise<RagAdminGenerationsResponseDto> {
    // ตรวจว่า attachment มีอยู่จริง
    const attachment = await this.attachmentRepository.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }

    const generations = await this.generationRepository.find({
      where: { attachmentUuid: attachmentPublicId },
      order: { createdAt: 'DESC' },
    });

    if (generations.length === 0) {
      return { attachmentPublicId, generations: [] };
    }

    // ดึง chunkCount แบบ grouped (Q26)
    const generationUuids = generations.map((g) => g.generationUuid);
    const chunkCounts = await this.chunkRepository
      .createQueryBuilder('c')
      .select('c.generation_uuid AS generationUuid, COUNT(*) AS chunkCount')
      .where('c.generation_uuid IN (:...generationUuids)', { generationUuids })
      .groupBy('c.generation_uuid')
      .getRawMany<RawChunkCountRow>();

    const chunkCountMap = new Map<string, number>(
      chunkCounts.map((r) => [r.generationUuid, Number(r.chunkCount)])
    );

    const items: RagAdminGenerationItem[] = generations.map((g) => ({
      status: g.status,
      chunkCount: chunkCountMap.get(g.generationUuid) ?? 0,
      createdAt: g.createdAt,
      activatedAt: g.activatedAt ?? null,
      retiredAt: g.retiredAt ?? null,
      failedAt: g.failedAt ?? null,
      errorCode: g.errorCode ?? null,
      errorMessage: g.errorMessage ?? null,
    }));

    return { attachmentPublicId, generations: items };
  }

  /**
   * Force re-ingest attachment (US3, Q12)
   * - ตรวจ checksum ก่อน (edge case — I2)
   * - ตรวจ BUILDING status ก่อน delegate (Q13) → 409 Conflict
   * - Delegate ไป existing ingest() (Q12)
   */
  public async reingest(
    attachmentPublicId: string
  ): Promise<RagAdminReingestResponseDto> {
    const attachment = await this.attachmentRepository.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }
    if (!attachment.checksum) {
      throw new ValidationException('Checksum is required for re-ingest', [
        { field: 'checksum', message: 'ต้องมี checksum สำหรับ re-ingest' },
      ]);
    }

    // ตรวจ BUILDING status ก่อน (Q13)
    const building = await this.generationRepository.findOne({
      where: { attachmentUuid: attachmentPublicId, status: 'BUILDING' },
    });
    if (building) {
      throw new ConflictException(
        'RAG_BUILDING_IN_PROGRESS',
        `Attachment ${attachmentPublicId} already has a BUILDING generation`,
        'กำลัง ingest อยู่ กรุณารอให้เสร็จก่อน',
        ['รอให้ ingestion ปัจจุบันเสร็จก่อน', 'ตรวจสอบสถานะใน Lifecycle tab']
      );
    }

    // Delegate ไป existing ingest() (Q12)
    const generation = await this.ingestionService.ingest(
      attachmentPublicId,
      true
    );

    // Enqueue BullMQ job — if enqueue fails, mark generation FAILED to avoid dangling BUILDING
    try {
      const jobId = await this.aiQueueService.enqueueRagAttachmentIngestion({
        attachmentPublicId,
        attachmentChecksum: generation.attachmentChecksumSnapshot,
        force: true,
      });

      return {
        attachmentPublicId,
        status: 'BUILDING',
        jobId,
      };
    } catch (err) {
      this.logger.error(
        `reingest: BullMQ enqueue failed for ${attachmentPublicId}, marking generation FAILED — ${(err as Error).message}`
      );
      await this.generationRepository.update(
        { generationUuid: generation.generationUuid },
        {
          status: 'FAILED',
          failedAt: new Date(),
          errorCode: 'ENQUEUE_FAILED',
          errorMessage: `BullMQ enqueue failed: ${(err as Error).message}`,
        }
      );
      throw err;
    }
  }

  /**
   * List failed ingestions แบบ 2 sections (US5, Q31)
   * - ragFailures: paginated (from RagAttachmentGeneration.status='FAILED')
   * - aiPipelineFailures: read-only, not paginated (from Attachment.aiProcessingStatus='FAILED')
   */
  public async listFailedIngestions(
    dto: RagAdminFailedIngestionsDto
  ): Promise<RagAdminFailedIngestionsResponseDto> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? RagAdminPageSize.TWENTY;
    const offset = (page - 1) * pageSize;

    // Section 1: RAG failures (paginated)
    const ragQb = this.generationRepository
      .createQueryBuilder('g')
      .innerJoin(Attachment, 'a', 'a.publicId = g.attachment_uuid')
      .select([
        'a.publicId AS attachmentPublicId',
        'a.originalFilename AS originalFilename',
        'g.error_code AS errorCode',
        'g.error_message AS errorMessage',
        'g.failed_at AS failedAt',
      ])
      .where('g.status = :status', { status: 'FAILED' });

    const ragTotal = await ragQb.getCount();
    const ragRows = await ragQb
      .orderBy('g.failed_at', 'DESC')
      .skip(offset)
      .take(pageSize)
      .getRawMany<RawRagFailureRow>();

    const ragFailures: RagAdminFailureItem[] = ragRows.map((r) => ({
      attachmentPublicId: r.attachmentPublicId,
      originalFilename: r.originalFilename,
      ragStatus: 'FAILED' as const,
      errorCode: r.errorCode ?? null,
      errorMessage: r.errorMessage ?? null,
      failedAt: r.failedAt ?? null,
    }));

    // Section 2: AI pipeline failures (read-only, not paginated — Q32)
    const aiQb = this.attachmentRepository
      .createQueryBuilder('a')
      .select([
        'a.publicId AS attachmentPublicId',
        'a.originalFilename AS originalFilename',
        'a.aiProcessingStatus AS aiProcessingStatus',
      ])
      .where('a.aiProcessingStatus = :status', { status: 'FAILED' });

    const aiTotal = await aiQb.getCount();

    const aiRows = await aiQb
      .orderBy('a.createdAt', 'DESC')
      .getRawMany<RawAiPipelineFailureRow>();

    const aiPipelineFailures: AiPipelineFailureItem[] = aiRows.map((r) => ({
      attachmentPublicId: r.attachmentPublicId,
      originalFilename: r.originalFilename,
      aiProcessingStatus: 'FAILED' as const,
      errorMessage: null,
    }));

    return {
      ragFailures: {
        items: ragFailures,
        total: ragTotal,
        page,
        pageSize,
      },
      aiPipelineFailures: {
        items: aiPipelineFailures,
        total: aiTotal,
      },
    };
  }

  /**
   * Batch retry failed ingestions (US5, Q17)
   * - Partial-success format
   * - Max 50 (validated by DTO @ArrayMaxSize(50))
   * - 1 BullMQ job per attachment (Q37)
   * - BullMQ jobId dedup prevents duplicates (Q18)
   */
  public async batchRetry(
    attachmentPublicIds: string[]
  ): Promise<RagAdminBatchRetryResponseDto> {
    const succeeded: BatchRetrySuccessItem[] = [];
    const failed: BatchRetryFailedItem[] = [];

    for (const attachmentPublicId of attachmentPublicIds) {
      try {
        // ตรวจ latest generation status
        const latest = await this.generationRepository.findOne({
          where: { attachmentUuid: attachmentPublicId },
          order: { createdAt: 'DESC' },
        });

        if (!latest) {
          failed.push({
            attachmentPublicId,
            reason: 'No generation found for this attachment',
          });
          continue;
        }

        if (latest.status !== 'FAILED') {
          failed.push({
            attachmentPublicId,
            reason: `Latest generation status is ${latest.status}, only FAILED can be retried`,
          });
          continue;
        }

        // Call retryIngestion() — mark FAILED→RETIRED before creating BUILDING (Q35, Q36)
        const jobId = await this.retryIngestion(attachmentPublicId, latest);
        succeeded.push({ attachmentPublicId, jobId });
      } catch (err) {
        this.logger.error(
          `Failed to retry attachment ${attachmentPublicId}: ${(err as Error).message}`
        );
        failed.push({
          attachmentPublicId,
          reason: (err as Error).message ?? 'Unknown error',
        });
      }
    }

    return {
      succeeded,
      failed,
      totalRequested: attachmentPublicIds.length,
      totalSucceeded: succeeded.length,
      totalFailed: failed.length,
    };
  }

  /**
   * Retry ingestion สำหรับ FAILED generation (Q35, Q36)
   * - Mark FAILED→RETIRED (retiredAt=now())
   * - Call existing ingest(attachmentPublicId, true) → creates new BUILDING
   * - Enqueue BullMQ job
   * Internal method — called by batchRetry()
   */
  private async retryIngestion(
    attachmentPublicId: string,
    failedGeneration: RagAttachmentGeneration
  ): Promise<string> {
    // Step 1: Mark FAILED→RETIRED (Q35, Q36)
    await this.generationRepository.update(
      { generationUuid: failedGeneration.generationUuid },
      { status: 'RETIRED', retiredAt: new Date() }
    );

    // Step 2: Call existing ingest() → creates new BUILDING
    const newGeneration = await this.ingestionService.ingest(
      attachmentPublicId,
      true
    );

    // Step 3: Enqueue BullMQ job (1 job per attachment — Q37)
    const jobId = await this.aiQueueService.enqueueRagAttachmentIngestion({
      attachmentPublicId,
      attachmentChecksum: newGeneration.attachmentChecksumSnapshot,
      force: true,
    });

    return jobId;
  }
}
