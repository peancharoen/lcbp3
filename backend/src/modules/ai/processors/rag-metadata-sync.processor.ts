// File: backend/src/modules/ai/processors/rag-metadata-sync.processor.ts
// Change Log:
// - 2026-09-14: T070 — เพิ่ม BullMQ processor สำหรับ async Qdrant metadata sync (Feature 254, Phase 7 US5)
//   อัปเดต classification metadata ใน Qdrant payload โดยไม่ต้อง re-embed (ADR-008, ADR-023)

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { AiQdrantService } from '../qdrant.service';
import { QUEUE_AI_RAG_INGEST } from '../../common/constants/queue.constants';
import { JOB_RAG_METADATA_SYNC } from '../../common/constants/queue.constants';
import type { RagMetadataSyncJobPayload } from '../ai-queue.service';

/**
 * Processor สำหรับ sync classification metadata ไปยัง Qdrant แบบ asynchronous
 * ทำหน้าที่: อ่าน classification ปัจจุบันจาก Attachment → อัปเดต Qdrant payload
 * ไม่ต้อง re-embed เพราะ classification เป็น metadata field ไม่ใช่ vector
 */
@Processor(QUEUE_AI_RAG_INGEST, { concurrency: 1 })
export class RagMetadataSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(RagMetadataSyncProcessor.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly qdrantService: AiQdrantService
  ) {
    super();
  }

  /**
   * ประมวลผล Qdrant metadata sync job
   * อ่าน classification ปัจจุบันจาก DB (source of truth) แล้วอัปเดต Qdrant payload
   * @param job BullMQ job ที่มี RagMetadataSyncJobPayload
   */
  async process(job: Job<RagMetadataSyncJobPayload>): Promise<void> {
    const { attachmentPublicId, generationUuid } = job.data;
    this.logger.log(
      `Processing Qdrant metadata sync — attachment=${attachmentPublicId}, ` +
        `generation=${generationUuid}`
    );

    const attachment = await this.attachmentRepository.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      this.logger.warn(
        `Attachment ${attachmentPublicId} not found — skipping metadata sync`
      );
      return;
    }

    await this.qdrantService.updateClassificationMetadata(
      attachmentPublicId,
      attachment.classification
    );

    this.logger.log(
      `Qdrant metadata sync complete — attachment=${attachmentPublicId}, ` +
        `classification=${attachment.classification}`
    );
  }
}

/** Job name สำหรับลงทะเบียนใน queue (re-export เพื่อความชัดเจน) */
export { JOB_RAG_METADATA_SYNC as RAG_METADATA_SYNC_JOB };
