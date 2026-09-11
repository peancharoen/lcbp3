// File: backend/src/modules/ai/processors/rag-generation-retention.processor.ts
// Change Log:
// - 2026-09-11: T052 — เพิ่ม BullMQ WorkerHost สำหรับ FAILED generation 30-day retention (Feature 254, Phase 5 US3)

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { Repository, LessThan } from 'typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { AiQdrantService } from '../qdrant.service';
import { RagObservabilityService } from '../services/rag-observability.service';
import { QUEUE_AI_RAG_INGEST } from '../../common/constants/queue.constants';

/** Payload สำหรับ FAILED generation retention cleanup job */
export interface RagGenerationRetentionJobPayload {
  /** จำกัดจำนวน generations ที่จะ cleanup ต่อ job (default 100) */
  batchSize?: number;
}

/** ระยะเวลาคงอยู่ของ FAILED generation ก่อน purge (30 วัน) */
const FAILED_GENERATION_RETENTION_DAYS = 30;

/**
 * Processor สำหรับ cleanup FAILED generations ที่เก่ากว่า 30 วัน
 * ลบ Qdrant vectors, chunks, pages, และ generation record
 * เพื่อป้องกัน accumulation ของ failed generations ในระบบ
 *
 * ควรรันเป็น periodic job (เช่น daily) ผ่าน BullMQ scheduler
 */
@Processor(QUEUE_AI_RAG_INGEST)
export class RagGenerationRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RagGenerationRetentionProcessor.name);

  constructor(
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    @InjectRepository(RagAttachmentPage)
    private readonly pageRepository: Repository<RagAttachmentPage>,
    private readonly qdrantService: AiQdrantService,
    @Optional()
    private readonly observabilityService?: RagObservabilityService
  ) {
    super();
  }

  /**
   * ประมวลผล retention cleanup สำหรับ FAILED generations ที่เก่ากว่า 30 วัน
   * @param job BullMQ job ที่อาจมี batchSize สำหรับจำกัดจำนวน
   */
  async process(job: Job<RagGenerationRetentionJobPayload>): Promise<void> {
    const batchSize = job.data?.batchSize ?? 100;
    this.logger.log(
      `Starting FAILED generation retention cleanup — batchSize=${batchSize}, job=${String(job.id)}`
    );

    const threshold = new Date(
      Date.now() - FAILED_GENERATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const failedGenerations = await this.generationRepository.find({
      where: {
        status: 'FAILED' as never,
        failedAt: LessThan(threshold),
      },
      take: batchSize,
      order: { failedAt: 'ASC' },
    });

    if (failedGenerations.length === 0) {
      this.logger.log('No FAILED generations past retention threshold');
      return;
    }

    let purged = 0;
    let failed = 0;

    for (const generation of failedGenerations) {
      try {
        await this.purgeFailedGeneration(generation.generationUuid);
        purged++;
      } catch (err: unknown) {
        failed++;
        this.logger.error(
          `Retention purge failed for generation ${generation.generationUuid}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    this.logger.log(
      `FAILED generation retention cleanup complete — purged=${purged}, failed=${failed}`
    );
  }

  /**
   * ลบ FAILED generation หนึ่งตัว — Qdrant vectors, chunks, pages, generation record
   * @param generationUuid UUID ของ FAILED generation ที่จะ purge
   */
  private async purgeFailedGeneration(generationUuid: string): Promise<void> {
    // ดึง chunk public IDs เพื่อลบจาก Qdrant
    const chunks = await this.chunkRepository.find({
      where: { generationUuid },
      select: ['chunkPublicId'],
    });

    if (chunks.length > 0) {
      const pointIds = chunks.map((c) => c.chunkPublicId);
      this.observabilityService?.recordQdrantDeletionAttempted(pointIds.length);
      try {
        await this.qdrantService.deleteByPointIds(pointIds);
        this.observabilityService?.recordQdrantDeletionSucceeded(
          pointIds.length
        );
      } catch (err: unknown) {
        this.observabilityService?.recordQdrantPartialFailure(
          generationUuid,
          err instanceof Error ? err.message : String(err)
        );
        throw err;
      }
    }

    // ลบ chunks, pages, generation record จาก MariaDB
    await this.chunkRepository.delete({ generationUuid });
    await this.pageRepository.delete({ generationUuid });
    await this.generationRepository.delete({ generationUuid });

    this.logger.debug(
      `Purged FAILED generation ${generationUuid} — vectors=${chunks.length}`
    );
  }
}
