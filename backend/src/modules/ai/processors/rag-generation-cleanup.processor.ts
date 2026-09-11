// File: backend/src/modules/ai/processors/rag-generation-cleanup.processor.ts
// Change Log:
// - 2026-09-11: T050 — เพิ่ม BullMQ WorkerHost สำหรับ RETIRED generation cleanup (Feature 254, Phase 5 US3)

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import {
  PendingVectorDeletion,
  PendingVectorDeletionStatus,
} from '../entities/pending-vector-deletion.entity';
import { AiQdrantService } from '../qdrant.service';
import { RagObservabilityService } from '../services/rag-observability.service';
import { QUEUE_AI_RAG_INGEST } from '../../common/constants/queue.constants';
import type { RagGenerationCleanupJobPayload } from '../ai-queue.service';

/**
 * Processor สำหรับ cleanup RETIRED generation
 * ลบ Qdrant vectors ก่อน แล้วลบ chunks/pages/generation จาก MariaDB
 * หาก Qdrant deletion ล้มเหลว จะบันทึก pending vector deletion (compensation)
 * แล้ว throw error เพื่อ trigger BullMQ retry (ADR-008)
 */
@Processor(QUEUE_AI_RAG_INGEST)
export class RagGenerationCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(RagGenerationCleanupProcessor.name);

  constructor(
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    @InjectRepository(RagAttachmentPage)
    private readonly pageRepository: Repository<RagAttachmentPage>,
    @InjectRepository(PendingVectorDeletion)
    private readonly pendingVectorDeletionRepository: Repository<PendingVectorDeletion>,
    private readonly qdrantService: AiQdrantService,
    @Optional()
    private readonly observabilityService?: RagObservabilityService
  ) {
    super();
  }

  /**
   * ประมวลผล cleanup job สำหรับ RETIRED generation
   * Safety guard: ข้ามถ้า generation ไม่ใช่ RETIRED หรือไม่พบ
   * @param job BullMQ job ที่มี generationUuid, attachmentPublicId, projectPublicId
   * @throws Error เมื่อ Qdrant deletion ล้มเหลว (trigger BullMQ retry)
   */
  async process(job: Job<RagGenerationCleanupJobPayload>): Promise<void> {
    const { generationUuid, attachmentPublicId, projectPublicId } = job.data;
    this.logger.log(
      `Processing RETIRED generation cleanup — generation=${generationUuid}, job=${String(job.id)}`
    );
    this.observabilityService?.recordCleanupProcessed();

    // Safety guard — ตรวจสอบว่า generation เป็น RETIRED เท่านั้น
    const generation = await this.generationRepository.findOne({
      where: { generationUuid },
    });
    if (!generation) {
      this.logger.warn(
        `Generation ${generationUuid} not found — skipping cleanup`
      );
      return;
    }
    if (generation.status !== 'RETIRED') {
      this.logger.warn(
        `Generation ${generationUuid} is ${generation.status}, not RETIRED — skipping cleanup`
      );
      return;
    }

    // ดึง chunk public IDs เพื่อลบจาก Qdrant
    const chunks = await this.chunkRepository.find({
      where: { generationUuid },
      select: ['chunkPublicId'],
    });
    const pointIds = chunks.map((c) => c.chunkPublicId);

    // ลบ Qdrant vectors — ถ้าล้มเหลวจะบันทึก pending deletion แล้ว throw เพื่อ retry
    this.observabilityService?.recordQdrantDeletionAttempted(pointIds.length);
    try {
      await this.qdrantService.deleteByPointIds(pointIds);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Qdrant deletion failed for generation ${generationUuid}: ${errorMessage} — recording pending vector deletion`
      );
      this.observabilityService?.recordQdrantPartialFailure(
        generationUuid,
        errorMessage
      );

      // Compensation: บันทึก pending vector deletion เพื่อ retry ภายหลัง
      const pendingDeletion = this.pendingVectorDeletionRepository.create({
        publicId: uuidv7(),
        documentPublicId: attachmentPublicId,
        projectPublicId,
        status: PendingVectorDeletionStatus.PENDING,
      });
      await this.pendingVectorDeletionRepository.save(pendingDeletion);
      this.observabilityService?.recordPendingRetryCreated();

      // Re-throw เพื่อ trigger BullMQ retry (ไม่ catch ปิดไว้)
      throw err;
    }

    this.observabilityService?.recordQdrantDeletionSucceeded(pointIds.length);

    // ลบ chunks จาก MariaDB
    await this.chunkRepository.delete({ generationUuid });

    // ลบ pages จาก MariaDB
    await this.pageRepository.delete({ generationUuid });

    // ลบ generation record เป็นอันดับสุดท้าย
    await this.generationRepository.delete({ generationUuid });

    this.observabilityService?.recordCleanupSucceeded();
    this.logger.log(
      `RETIRED generation cleanup complete — generation=${generationUuid}, vectors=${pointIds.length}`
    );
  }
}
